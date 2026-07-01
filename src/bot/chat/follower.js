const DEFAULT_RECONNECT_ATTEMPTS = 3;
const DEFAULT_RECONNECT_DELAY_MS = 1000;
const DEFAULT_FALLBACK_POLL_INTERVAL_MS = 3000;
const DEFAULT_FALLBACK_POLL_MAX_MS = 180000;

export function createRunFollowerRegistry({
  acornOpsClient,
  commandContextStore,
  postFollowUp,
  logger = console,
  reconnectAttempts = numberFromEnv("RUN_STREAM_RECONNECT_ATTEMPTS", DEFAULT_RECONNECT_ATTEMPTS),
  reconnectDelayMs = numberFromEnv("RUN_STREAM_RECONNECT_DELAY_MS", DEFAULT_RECONNECT_DELAY_MS, { allowZero: true }),
  fallbackPollIntervalMs = numberFromEnv("RUN_STREAM_FALLBACK_POLL_INTERVAL_MS", DEFAULT_FALLBACK_POLL_INTERVAL_MS, { allowZero: true }),
  fallbackPollMaxMs = numberFromEnv("RUN_STREAM_FALLBACK_POLL_MAX_MS", DEFAULT_FALLBACK_POLL_MAX_MS, { allowZero: true })
}) {
  const active = new Map();

  return {
    start({ identity, sessionId, runId, messageId = "", channelId }) {
      if (!identity?.externalUserId || !runId || !sessionId || !channelId) {
        return false;
      }

      if (active.has(identity.externalUserId)) {
        return false;
      }

      const controller = new AbortController();
      const entry = {
        identity,
        sessionId,
        runId,
        messageId,
        channelId,
        controller,
        finalPosted: false
      };
      active.set(identity.externalUserId, entry);
      commandContextStore.rememberActiveRun?.(identity.externalUserId, {
        id: runId,
        sessionId,
        status: "streaming"
      });

      followRun({
        entry,
        acornOpsClient,
        commandContextStore,
        postFollowUp,
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

    abort(externalUserId) {
      const entry = active.get(externalUserId);
      if (entry) {
        entry.controller.abort();
        active.delete(externalUserId);
      }
      commandContextStore.clearActiveRun?.(externalUserId);
    },

    has(externalUserId) {
      return active.has(externalUserId);
    }
  };
}

async function followRun({
  entry,
  acornOpsClient,
  commandContextStore,
  postFollowUp,
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
        entry
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

  active.delete(entry.identity.externalUserId);
  commandContextStore.clearActiveRun?.(entry.identity.externalUserId, entry.runId);
}

async function streamUntilTerminal({ acornOpsClient, entry }) {
  if (typeof acornOpsClient.streamRun !== "function") {
    return "";
  }

  const events = await acornOpsClient.streamRun(entry.identity, entry.runId, {
    signal: entry.controller.signal
  });
  for await (const event of events) {
    const status = terminalStatusFromEvent(event);
    if (status) {
      return status;
    }
  }

  return "";
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
    : terminalRunMessage(status);

  try {
    if (!entry.controller.signal.aborted && message) {
      await postFollowUp({
        channelId: entry.channelId,
        message
      });
    }
  } finally {
    active.delete(entry.identity.externalUserId);
    commandContextStore.clearActiveRun?.(entry.identity.externalUserId, entry.runId);
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

function terminalRunMessage(status) {
  if (status === "failed") {
    return "AcornOps could not complete that response.";
  }

  if (status === "cancelled") {
    return "AcornOps cancelled that response.";
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
