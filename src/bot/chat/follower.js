const DEFAULT_RECONNECT_ATTEMPTS = 3;
const DEFAULT_RECONNECT_DELAY_MS = 1000;
const DEFAULT_FALLBACK_POLL_INTERVAL_MS = 3000;
const DEFAULT_FALLBACK_POLL_MAX_MS = 180000;

export function createRunFollowerRegistry({
  acornOpsClient,
  commandContextStore,
  postFollowUp,
  acornOpsConsoleUrl = "",
  logger = console,
  reconnectAttempts = numberFromEnv("RUN_STREAM_RECONNECT_ATTEMPTS", DEFAULT_RECONNECT_ATTEMPTS),
  reconnectDelayMs = numberFromEnv("RUN_STREAM_RECONNECT_DELAY_MS", DEFAULT_RECONNECT_DELAY_MS, { allowZero: true }),
  fallbackPollIntervalMs = numberFromEnv("RUN_STREAM_FALLBACK_POLL_INTERVAL_MS", DEFAULT_FALLBACK_POLL_INTERVAL_MS, { allowZero: true }),
  fallbackPollMaxMs = numberFromEnv("RUN_STREAM_FALLBACK_POLL_MAX_MS", DEFAULT_FALLBACK_POLL_MAX_MS, { allowZero: true })
}) {
  const active = new Map();

  return {
    start({ identity, sessionId, runId, messageId = "", workspaceId = "", channelId, rootId = "", kind = "chat" }) {
      if (!identity?.externalUserId || !runId || !sessionId || !channelId) {
        return false;
      }

      const key = activeKey(identity.externalUserId, channelId, rootId);
      if (active.has(key)) {
        return false;
      }

      const controller = new AbortController();
      const entry = {
        identity,
        sessionId,
        runId,
        messageId,
        workspaceId,
        channelId,
        rootId,
        kind,
        key,
        controller,
        finalPosted: false,
        notifiedApprovalIds: new Set(),
        notifiedApprovalStatuses: new Set()
      };
      active.set(key, entry);
      const activeRun = {
        id: runId,
        sessionId,
        status: "streaming"
      };
      if (rootId) {
        commandContextStore.rememberActiveRunForChat?.(channelId, rootId, activeRun);
      } else {
        commandContextStore.rememberActiveRun?.(identity.externalUserId, activeRun);
      }

      followRun({
        entry,
        acornOpsClient,
        commandContextStore,
        postFollowUp,
        acornOpsConsoleUrl,
        logger,
        reconnectAttempts,
        reconnectDelayMs,
        fallbackPollIntervalMs,
        fallbackPollMaxMs,
        active
      }).catch((error) => {
        if (!isAbortError(error)) {
          logger.error(error instanceof Error ? error.message : error);
        }
      });

      return true;
    },

    abort(externalUserId, { channelId = "", rootId = "" } = {}) {
      const key = activeKey(externalUserId, channelId, rootId);
      const entry = active.get(key);
      if (entry) {
        entry.controller.abort();
        active.delete(key);
      }
      if (rootId) {
        commandContextStore.clearActiveRunForChat?.(channelId, rootId);
      } else {
        commandContextStore.clearActiveRun?.(externalUserId);
      }
    },

    abortAllForUser(externalUserId) {
      for (const [key, entry] of active.entries()) {
        if (entry.identity.externalUserId === externalUserId) {
          entry.controller.abort();
          active.delete(key);
        }
      }
      commandContextStore.clearActiveRun?.(externalUserId);
    },

    has(externalUserId, { channelId = "", rootId = "" } = {}) {
      return active.has(activeKey(externalUserId, channelId, rootId));
    }
  };
}

function activeKey(externalUserId, channelId = "", rootId = "") {
  return rootId ? `${externalUserId}:${channelId}:${rootId}` : externalUserId;
}

async function followRun({
  entry,
  acornOpsClient,
  commandContextStore,
  postFollowUp,
  acornOpsConsoleUrl,
  logger,
  reconnectAttempts,
  reconnectDelayMs,
  fallbackPollIntervalMs,
  fallbackPollMaxMs,
  active
}) {
  let status = "";

  for (let attempt = 0; attempt <= reconnectAttempts; attempt += 1) {
    if (entry.controller.signal.aborted) {
      return;
    }

    try {
      const streamStatus = await streamUntilTerminal({
        acornOpsClient,
        entry,
        postFollowUp,
        acornOpsConsoleUrl
      });
      if (streamStatus) {
        status = streamStatus;
        await postTerminalResult({
          status,
          entry,
          acornOpsClient,
          commandContextStore,
          postFollowUp,
          active
        });
        return;
      }
    } catch (error) {
      if (isAbortError(error) || entry.controller.signal.aborted) {
        return;
      }
      logger.error(error instanceof Error ? error.message : error);
    }

    const run = await getRunQuietly(acornOpsClient, entry);
    status = run?.status ?? status;
    if (isTerminalRunStatus(status)) {
      await postTerminalResult({
        status,
        entry,
        acornOpsClient,
        commandContextStore,
        postFollowUp,
        active
      });
      return;
    }

    if (attempt < reconnectAttempts && reconnectDelayMs > 0) {
      await sleep(reconnectDelayMs, entry.controller.signal);
    }
  }

  status = await fallbackPollUntilTerminal({
    status,
    entry,
    acornOpsClient,
    fallbackPollIntervalMs,
    fallbackPollMaxMs
  });
  if (isTerminalRunStatus(status)) {
    await postTerminalResult({
      status,
      entry,
      acornOpsClient,
      commandContextStore,
      postFollowUp,
      active
    });
    return;
  }

  active.delete(entry.key);
  if (entry.rootId) {
    commandContextStore.clearActiveRunForChat?.(entry.channelId, entry.rootId, entry.runId);
  } else {
    commandContextStore.clearActiveRun?.(entry.identity.externalUserId, entry.runId);
  }
}

async function streamUntilTerminal({ acornOpsClient, entry, postFollowUp, acornOpsConsoleUrl }) {
  if (typeof acornOpsClient.streamRun !== "function") {
    return "";
  }

  const events = await acornOpsClient.streamRun(entry.identity, entry.runId, {
    signal: entry.controller.signal
  });
  for await (const event of events) {
    if (event.event === "tool_approval_requested") {
      await postApprovalRequest({ event, entry, postFollowUp, acornOpsConsoleUrl });
    } else if (["tool_approval_approved", "tool_approval_rejected", "tool_approval_expired"].includes(event.event)) {
      await postApprovalStatus({ event, entry, postFollowUp });
    }
    const status = terminalStatusFromEvent(event);
    if (status) {
      return status;
    }
  }

  return "";
}

async function postApprovalStatus({ event, entry, postFollowUp }) {
  const payload = event.data?.payload ?? event.data ?? {};
  const approvalId = payload.approval_id ?? payload.approvalId ?? "";
  const key = `${approvalId}:${event.event}`;
  if (entry.notifiedApprovalStatuses.has(key)) {
    return;
  }
  entry.notifiedApprovalStatuses.add(key);
  const label = event.event.replace("tool_approval_", "");
  await postFollowUp({
    channelId: entry.channelId,
    rootId: entry.rootId,
    message: `AcornOps write request ${label}. ${label === "approved" ? "The bot is continuing to watch this run." : "The bot will keep watching for the run's final status."}`
  });
}

async function postApprovalRequest({ event, entry, postFollowUp, acornOpsConsoleUrl }) {
  const payload = event.data?.payload ?? event.data ?? {};
  const approvalId = payload.approval_id ?? payload.approvalId ?? "";
  if (!approvalId || entry.notifiedApprovalIds.has(approvalId)) {
    return;
  }
  entry.notifiedApprovalIds.add(approvalId);

  const tool = String(payload.tool ?? "write operation").trim();
  const summary = String(payload.summary ?? "").trim();
  const lines = [
    `AcornOps is waiting for manual approval to run **${tool}**${summary ? `: ${summary}` : "."}`
  ];
  const approvalUrl = buildApprovalUrl(acornOpsConsoleUrl, entry.workspaceId, entry.runId, approvalId);
  if (approvalUrl) {
    lines.push(`[Review this request in AcornOps](${approvalUrl}). The bot will keep watching and continue when the approval status changes.`);
  } else {
    lines.push("Open the AcornOps approval inbox to review it. The bot will keep watching and continue when the approval status changes.");
  }
  lines.push("This bot cannot approve or reject write requests.");
  await postFollowUp({ channelId: entry.channelId, rootId: entry.rootId, message: lines.join("\n") });
}

function buildApprovalUrl(baseUrl, workspaceId, runId, approvalId) {
  if (!baseUrl || !workspaceId || !runId || !approvalId) {
    return "";
  }
  try {
    const url = new URL(`/workspaces/${encodeURIComponent(workspaceId)}/approvals`, `${baseUrl.replace(/\/$/, "")}/`);
    url.searchParams.set("runId", runId);
    url.searchParams.set("approvalId", approvalId);
    return url.toString();
  } catch {
    return "";
  }
}

async function fallbackPollUntilTerminal({
  status,
  entry,
  acornOpsClient,
  fallbackPollIntervalMs,
  fallbackPollMaxMs
}) {
  if (typeof acornOpsClient.getRun !== "function") {
    return status;
  }

  const deadline = Date.now() + fallbackPollMaxMs;
  while (!entry.controller.signal.aborted && Date.now() <= deadline) {
    const run = await getRunQuietly(acornOpsClient, entry);
    status = run?.status ?? status;
    if (isTerminalRunStatus(status)) {
      return status;
    }

    if (fallbackPollIntervalMs <= 0) {
      break;
    }
    await sleep(fallbackPollIntervalMs, entry.controller.signal);
  }

  return status;
}

async function postTerminalResult({
  status,
  entry,
  acornOpsClient,
  commandContextStore,
  postFollowUp,
  active
}) {
  if (entry.finalPosted || entry.controller.signal.aborted) {
    return;
  }

  entry.finalPosted = true;
  commandContextStore.rememberLatestRun?.(entry.identity.externalUserId, {
    id: entry.runId,
    sessionId: entry.sessionId,
    status
  });

  const message = status === "completed"
    ? await completedRunMessage({ acornOpsClient, entry })
    : terminalRunMessage(status, entry.kind);

  try {
    if (!entry.controller.signal.aborted && message) {
      await postFollowUp({
        channelId: entry.channelId,
        message,
        rootId: entry.rootId
      });
    }
  } finally {
    active.delete(entry.key);
    if (entry.rootId) {
      commandContextStore.clearActiveRunForChat?.(entry.channelId, entry.rootId, entry.runId);
    } else {
      commandContextStore.clearActiveRun?.(entry.identity.externalUserId, entry.runId);
    }
  }
}

async function completedRunMessage({ acornOpsClient, entry }) {
  const run = await getRunQuietly(acornOpsClient, entry);
  const runMessageId = run?.messageId ?? run?.message_id ?? "";
  if (entry.messageId && runMessageId && runMessageId !== entry.messageId) {
    return "AcornOps finished, but I could not match the assistant reply to this question.";
  }

  const inlineAnswer = assistantMessageContent(
    run?.assistantMessage?.content ?? run?.assistant_message?.content ?? ""
  );
  if (inlineAnswer) {
    return inlineAnswer;
  }

  if (entry.kind === "workflow") {
    return "AcornOps completed the workflow, but I could not load its result yet.";
  }

  if (typeof acornOpsClient.listSessionMessages !== "function") {
    return "AcornOps finished, but I could not load the assistant reply yet.";
  }

  try {
    const page = await acornOpsClient.listSessionMessages(entry.identity, entry.sessionId);
    return newestAssistantMessage(page, entry.runId)
      || "AcornOps finished, but I could not load the assistant reply yet.";
  } catch {
    return "AcornOps finished, but I could not load the assistant reply yet.";
  }
}

function terminalRunMessage(status, kind = "chat") {
  const subject = kind === "workflow" ? "workflow" : "response";
  if (status === "failed") {
    return `AcornOps could not complete that ${subject}.`;
  }

  if (status === "cancelled") {
    return `AcornOps cancelled that ${subject}.`;
  }

  return "";
}

async function getRunQuietly(acornOpsClient, entry) {
  if (typeof acornOpsClient.getRun !== "function") {
    return null;
  }

  try {
    return await acornOpsClient.getRun(entry.identity, entry.runId);
  } catch {
    return null;
  }
}

function newestAssistantMessage(page, runId) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const matching = items.filter((message) => {
    const role = message.role ?? message.kind;
    const messageRunId = message.runId ?? message.run_id;
    return role === "assistant" && messageRunId === runId;
  });
  return assistantMessageContent(matching.at(-1)?.content ?? "");
}

function assistantMessageContent(value) {
  return String(value).trim().slice(0, 3900);
}

function terminalStatusFromEvent(event) {
  if (event.event === "run_completed") {
    return "completed";
  }
  if (event.event === "run_failed") {
    return "failed";
  }
  if (event.event === "run_cancelled") {
    return "cancelled";
  }

  const status = event.data?.status ?? "";
  return isTerminalRunStatus(status) ? status : "";
}

function isTerminalRunStatus(status) {
  return ["completed", "failed", "cancelled"].includes(status);
}

function sleep(ms, signal) {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(abortError());
    }, { once: true });
  });
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function abortError() {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function numberFromEnv(name, fallback, { allowZero = false } = {}) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  if (Number.isFinite(value) && (value > 0 || (allowZero && value === 0))) {
    return value;
  }

  return fallback;
}
