import { randomUUID } from "node:crypto";

export function chatClientMessageId({ sourceMessageId }) {
  const postPart = safeClientMessageIdPart(sourceMessageId);
  if (postPart) {
    return `mm-post-${postPart}`;
  }

  return `mm-local-${localMessageIdPart()}`;
}

function localMessageIdPart() {
  try {
    return randomUUID();
  } catch {
    return safeClientMessageIdPart(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  }
}

function safeClientMessageIdPart(value) {
  return String(value ?? "")
    .replace(/[^A-Za-z0-9._~-]/g, "-")
    .slice(0, 120);
}

export async function followRunForAnswer({ acornOpsClient, identity, session, runId, messageId }) {
  if (!runId || typeof acornOpsClient.getRun !== "function") {
    return {};
  }

  let status = "";
  const attempts = chatRunPollAttempts();
  const pollIntervalMs = chatRunPollIntervalMs();
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let run;
    try {
      run = await acornOpsClient.getRun(identity, runId);
    } catch {
      return status ? { status } : {};
    }

    status = run?.status ?? "";
    if (status === "completed") {
      const runMessageId = run?.messageId ?? run?.message_id ?? "";
      if (messageId && runMessageId && runMessageId !== messageId) {
        return { status };
      }

      const runAnswer = assistantMessageContent(run?.assistantMessage?.content ?? run?.assistant_message?.content ?? "");
      if (runAnswer) {
        return { status, answer: runAnswer };
      }

      if (typeof acornOpsClient.listSessionMessages !== "function") {
        return { status };
      }

      try {
        const page = await acornOpsClient.listSessionMessages(identity, session.id);
        const answer = newestAssistantMessage(page, runId);
        return { status, answer };
      } catch {
        return { status };
      }
    }

    if (isTerminalRunStatus(status)) {
      return { status };
    }

    if (status === "waiting_for_approval") {
      return { status };
    }

    if (attempt < attempts - 1 && pollIntervalMs > 0) {
      await sleep(pollIntervalMs);
    }
  }

  return status ? { status } : {};
}

function newestAssistantMessage(page, runId) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const matching = items.filter((message) => {
    const role = message.role ?? message.kind;
    const messageRunId = message.runId ?? message.run_id;
    return role === "assistant" && messageRunId === runId;
  });
  const message = matching.at(-1);
  return assistantMessageContent(message?.content ?? "");
}

function assistantMessageContent(value) {
  return String(value).trim().slice(0, 3900);
}

export function formatChatPendingResponse(status) {
  if (status === "completed") {
    return [
      "AcornOps finished, but I could not load the assistant reply yet.",
      "Reply in this thread to keep chatting, or use `!chat end` to close it."
    ].join("\n");
  }

  if (status === "failed" || status === "cancelled") {
    return [
      `AcornOps could not complete that response (${status}).`,
      "Reply in this thread to keep chatting, or use `!chat end` to close it."
    ].join("\n");
  }

  return [
    "I'm checking that now. I'll post the answer here when it's ready.",
    "Reply in this thread to keep chatting, or use `!chat end` to close it."
  ].join("\n");
}

export function activeRunResponseText() {
  return "AcornOps is still responding. Wait for that answer, or use `!chat end` in this thread to stop following it.";
}

function isTerminalRunStatus(status) {
  return ["completed", "failed", "cancelled"].includes(status);
}

function chatRunPollAttempts() {
  return positiveIntegerFromEnv("CHAT_RUN_POLL_ATTEMPTS", 15);
}

function chatRunPollIntervalMs() {
  return positiveIntegerFromEnv("CHAT_RUN_POLL_INTERVAL_MS", 1000, { allowZero: true });
}

function positiveIntegerFromEnv(name, fallback, { allowZero = false } = {}) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  if (Number.isInteger(value) && (value > 0 || (allowZero && value === 0))) {
    return value;
  }
  return fallback;
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
