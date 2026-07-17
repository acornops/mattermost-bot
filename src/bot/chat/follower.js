const DEFAULT_RECONNECT_ATTEMPTS = 3;
const DEFAULT_RECONNECT_DELAY_MS = 1000;
const DEFAULT_FALLBACK_POLL_INTERVAL_MS = 3000;
const DEFAULT_FALLBACK_POLL_MAX_MS = 180000;

export function createRunFollowerRegistry({
  acornOpsClient,
  commandContextStore,
  postFollowUp,
  acornOpsConsoleUrl = "",
  botPublicBaseUrl = "",
  mattermostActionSecret = "",
  logger = console,
  reconnectAttempts = numberFromEnv("RUN_STREAM_RECONNECT_ATTEMPTS", DEFAULT_RECONNECT_ATTEMPTS),
  reconnectDelayMs = numberFromEnv("RUN_STREAM_RECONNECT_DELAY_MS", DEFAULT_RECONNECT_DELAY_MS, { allowZero: true }),
  fallbackPollIntervalMs = numberFromEnv("RUN_STREAM_FALLBACK_POLL_INTERVAL_MS", DEFAULT_FALLBACK_POLL_INTERVAL_MS, { allowZero: true }),
  fallbackPollMaxMs = numberFromEnv("RUN_STREAM_FALLBACK_POLL_MAX_MS", DEFAULT_FALLBACK_POLL_MAX_MS, { allowZero: true })
}) {
  const active = new Map();

  return {
    start({
      identity,
      sessionId,
      runId,
      executionId = "",
      messageId = "",
      workspaceId = "",
      channelId,
      rootId = "",
      kind = "chat",
      lastEventId = ""
    }) {
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
        executionId,
        lastEventId,
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
        status: "streaming",
        kind,
        executionId,
        lastEventId
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
        botPublicBaseUrl,
        mattermostActionSecret,
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
  botPublicBaseUrl,
  mattermostActionSecret,
  logger,
  reconnectAttempts,
  reconnectDelayMs,
  fallbackPollIntervalMs,
  fallbackPollMaxMs,
  active
}) {
  if (entry.kind === "workflow" && entry.executionId
    && typeof acornOpsClient.streamWorkflowExecution === "function") {
    await followWorkflowExecution({
      entry,
      acornOpsClient,
      commandContextStore,
      postFollowUp,
      acornOpsConsoleUrl,
      botPublicBaseUrl,
      mattermostActionSecret,
      logger,
      reconnectAttempts,
      reconnectDelayMs,
      fallbackPollIntervalMs,
      fallbackPollMaxMs,
      active
    });
    return;
  }

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
        acornOpsConsoleUrl,
        botPublicBaseUrl,
        mattermostActionSecret
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

async function streamUntilTerminal({
  acornOpsClient,
  entry,
  postFollowUp,
  acornOpsConsoleUrl,
  botPublicBaseUrl,
  mattermostActionSecret
}) {
  if (typeof acornOpsClient.streamRun !== "function") {
    return "";
  }

  const events = await acornOpsClient.streamRun(entry.identity, entry.runId, {
    signal: entry.controller.signal
  });
  for await (const event of events) {
    if (event.event === "tool_approval_requested") {
      const payload = event.data?.payload ?? event.data ?? {};
      await postApprovalRequest({
        approval: {
          approvalId: payload.approval_id ?? payload.approvalId ?? "",
          runId: entry.runId,
          toolName: payload.tool ?? "write operation",
          summary: payload.summary ?? "",
          expiresAt: payload.expires_at ?? payload.expiresAt ?? ""
        },
        entry,
        postFollowUp,
        acornOpsConsoleUrl,
        botPublicBaseUrl,
        mattermostActionSecret
      });
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

async function followWorkflowExecution({
  entry,
  acornOpsClient,
  commandContextStore,
  postFollowUp,
  acornOpsConsoleUrl,
  botPublicBaseUrl,
  mattermostActionSecret,
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
      const events = await acornOpsClient.streamWorkflowExecution(
        entry.identity,
        entry.executionId,
        {
          signal: entry.controller.signal,
          after: entry.lastEventId
        }
      );
      for await (const event of events) {
        status = await handleWorkflowExecutionEvent({
          event,
          entry,
          commandContextStore,
          postFollowUp,
          acornOpsConsoleUrl,
          botPublicBaseUrl,
          mattermostActionSecret
        }) || status;
        if (isTerminalRunStatus(status)) {
          await refreshWorkflowEntry(acornOpsClient, entry);
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
      }
    } catch (error) {
      if (isAbortError(error) || entry.controller.signal.aborted) {
        return;
      }
      logger.error(error instanceof Error ? error.message : error);
    }

    status = await refreshWorkflowEntry(acornOpsClient, entry) || status;
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

  const deadline = Date.now() + fallbackPollMaxMs;
  while (!entry.controller.signal.aborted && Date.now() <= deadline) {
    status = await refreshWorkflowEntry(acornOpsClient, entry) || status;
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
    if (fallbackPollIntervalMs <= 0) {
      break;
    }
    await sleep(fallbackPollIntervalMs, entry.controller.signal);
  }

  clearFollowerEntry({ entry, commandContextStore, active });
}

async function handleWorkflowExecutionEvent({
  event,
  entry,
  commandContextStore,
  postFollowUp,
  acornOpsConsoleUrl,
  botPublicBaseUrl,
  mattermostActionSecret
}) {
  if (event.event !== "workflow_execution" || !event.data || typeof event.data !== "object") {
    return "";
  }
  const data = event.data;
  const eventId = String(data.id ?? event.id ?? "");
  if (eventId && !isWorkflowEventAfter(eventId, entry.lastEventId)) {
    return "";
  }
  entry.lastEventId = eventId || entry.lastEventId;
  if (data.runId) {
    entry.runId = data.runId;
  }
  rememberFollowerEntry(entry, commandContextStore);

  if (data.type === "approval_requested") {
    const payload = data.payload ?? {};
    await postApprovalRequest({
      approval: {
        approvalId: data.approvalId ?? "",
        runId: data.runId ?? entry.runId,
        toolName: payload.toolName ?? "write operation",
        summary: payload.summary ?? "",
        expiresAt: payload.expiresAt ?? ""
      },
      entry,
      postFollowUp,
      acornOpsConsoleUrl,
      botPublicBaseUrl,
      mattermostActionSecret
    });
  } else if (data.type === "approval_decided") {
    const payload = data.payload ?? {};
    await postWorkflowApprovalStatus({
      approvalId: data.approvalId ?? "",
      status: payload.status ?? payload.decision ?? "decided",
      entry,
      postFollowUp
    });
  } else if (data.type === "run_event") {
    const runEvent = data.payload?.runEvent ?? data.payload?.run_event ?? {};
    const runPayload = runEvent.payload ?? {};
    if (runEvent.type === "tool_approval_requested") {
      await postApprovalRequest({
        approval: {
          approvalId: runPayload.approval_id ?? runPayload.approvalId ?? "",
          runId: data.runId ?? entry.runId,
          toolName: runPayload.tool ?? runPayload.toolName ?? "write operation",
          summary: runPayload.summary ?? "",
          expiresAt: runPayload.expires_at ?? runPayload.expiresAt ?? ""
        },
        entry,
        postFollowUp,
        acornOpsConsoleUrl,
        botPublicBaseUrl,
        mattermostActionSecret
      });
    } else if (["tool_approval_approved", "tool_approval_rejected", "tool_approval_expired"].includes(runEvent.type)) {
      await postWorkflowApprovalStatus({
        approvalId: runPayload.approval_id ?? runPayload.approvalId ?? "",
        status: runEvent.type.replace("tool_approval_", ""),
        entry,
        postFollowUp
      });
    }
  }

  if (data.type === "execution_status_changed") {
    const status = data.payload?.status ?? "";
    return isTerminalRunStatus(status) ? status : "";
  }
  return "";
}

function isWorkflowEventAfter(candidate, cursor) {
  if (!cursor) {
    return true;
  }
  const candidateNumber = Number(candidate);
  const cursorNumber = Number(cursor);
  if (Number.isSafeInteger(candidateNumber) && Number.isSafeInteger(cursorNumber)) {
    return candidateNumber > cursorNumber;
  }
  return candidate !== cursor;
}

async function postWorkflowApprovalStatus({
  approvalId,
  status,
  entry,
  postFollowUp
}) {
  const key = `${approvalId}:${status}`;
  if (entry.notifiedApprovalStatuses.has(key)) {
    return;
  }
  entry.notifiedApprovalStatuses.add(key);
  await postFollowUp({
    channelId: entry.channelId,
    rootId: entry.rootId,
    message: `Approval ${status}. ${status === "approved"
      ? "AcornOps is continuing the workflow."
      : "I’ll keep watching for the workflow’s final status."}`
  });
}

function rememberFollowerEntry(entry, commandContextStore) {
  if (!entry.rootId) {
    return;
  }
  commandContextStore.rememberActiveRunForChat?.(
    entry.channelId,
    entry.rootId,
    {
      id: entry.runId,
      sessionId: entry.sessionId,
      status: "streaming",
      kind: entry.kind,
      executionId: entry.executionId,
      lastEventId: entry.lastEventId
    }
  );
}

async function refreshWorkflowEntry(acornOpsClient, entry) {
  if (typeof acornOpsClient.getWorkflowExecution !== "function") {
    return "";
  }
  try {
    const response = await acornOpsClient.getWorkflowExecution(
      entry.identity,
      entry.executionId
    );
    const attempts = Array.isArray(response?.attempts) ? response.attempts : [];
    const latest = attempts.at(-1);
    if (latest?.id) {
      entry.runId = latest.id;
    }
    return response?.execution?.status ?? response?.status ?? "";
  } catch {
    return "";
  }
}

function clearFollowerEntry({ entry, commandContextStore, active }) {
  active.delete(entry.key);
  if (entry.rootId) {
    commandContextStore.clearActiveRunForChat?.(entry.channelId, entry.rootId);
  } else {
    commandContextStore.clearActiveRun?.(entry.identity.externalUserId);
  }
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
    message: `Approval ${label}. ${label === "approved" ? "AcornOps is continuing the run." : "I’ll keep watching for the run’s final status."}`
  });
}

async function postApprovalRequest({
  approval,
  entry,
  postFollowUp,
  acornOpsConsoleUrl,
  botPublicBaseUrl,
  mattermostActionSecret
}) {
  const approvalId = approval.approvalId;
  if (!approvalId || entry.notifiedApprovalIds.has(approvalId)) {
    return;
  }
  entry.notifiedApprovalIds.add(approvalId);

  const tool = String(approval.toolName ?? "write operation").trim();
  const summary = String(approval.summary ?? "").trim();
  const lines = [
    `Approval required for **${tool}**${summary ? `: ${summary}` : "."}`
  ];
  if (approval.expiresAt) {
    lines.push(`Expires: ${approval.expiresAt}`);
  }
  const attachments = approvalDecisionAttachments({
    approval: {
      ...approval,
      toolName: tool,
      summary
    },
    entry,
    botPublicBaseUrl,
    mattermostActionSecret
  });
  if (attachments.length > 0) {
    lines.push("Choose a decision below. AcornOps will continue after the decision is recorded.");
  } else {
    const approvalUrl = buildApprovalUrl(
      acornOpsConsoleUrl,
      entry.workspaceId,
      approval.runId || entry.runId,
      approvalId
    );
    lines.push(approvalUrl
      ? `[Review this request in AcornOps](${approvalUrl}).`
      : "Open the AcornOps approval inbox to review this request.");
  }
  await postFollowUp({
    channelId: entry.channelId,
    rootId: entry.rootId,
    message: lines.join("\n"),
    attachments
  });
}

function approvalDecisionAttachments({
  approval,
  entry,
  botPublicBaseUrl,
  mattermostActionSecret
}) {
  const actionUrl = botPublicBaseUrl
    ? `${botPublicBaseUrl.replace(/\/+$/, "")}/mattermost/actions`
    : "";
  if (!actionUrl || !mattermostActionSecret) {
    return [];
  }

  const common = {
    action: "request_approval_decision",
    secret: mattermostActionSecret,
    externalUserId: entry.identity.externalUserId,
    runId: approval.runId || entry.runId,
    approvalId: approval.approvalId,
    workspaceId: entry.workspaceId,
    channelId: entry.channelId,
    rootId: entry.rootId,
    toolName: approval.toolName,
    summary: approval.summary,
    expiresAt: approval.expiresAt ?? ""
  };
  return [{
    text: "Confirm in Mattermost before the decision is sent to AcornOps.",
    actions: [
      {
        id: "approvalApprove",
        name: "Approve",
        type: "button",
        style: "primary",
        integration: {
          url: actionUrl,
          context: { ...common, decision: "approved" }
        }
      },
      {
        id: "approvalReject",
        name: "Reject",
        type: "button",
        style: "danger",
        integration: {
          url: actionUrl,
          context: { ...common, decision: "rejected" }
        }
      }
    ]
  }];
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
