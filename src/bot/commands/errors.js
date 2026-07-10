import { singleLine } from "./formatters.js";

export function workspaceErrorText(error) {
  const status = httpStatusFromError(error);
  if (status === 401) {
    return [
      "AcornOps workspaces could not be loaded because this external chat account is not linked or the bot credentials are invalid.",
      "Run `!login` in a direct message, then try `!workspaces` again."
    ].join("\n");
  }

  if (status === 404) {
    return "AcornOps workspace could not be found or is not accessible to this linked account.";
  }

  if (status) {
    return `AcornOps workspaces could not be loaded (HTTP ${status}). Try again later or check the bot logs.`;
  }

  return "AcornOps workspaces could not be loaded. Try again later or check the bot logs.";
}

export function dataErrorText(error, label) {
  const status = httpStatusFromError(error);
  if (status === 401) {
    return [
      `AcornOps ${label} could not be loaded because this external chat account is not linked or the bot credentials are invalid.`,
      "Run `!login` in a direct message, then try again."
    ].join("\n");
  }

  if (status === 403) {
    return `AcornOps ${label} are not permitted for this linked account.`;
  }

  if (status === 404) {
    return `AcornOps ${label} could not be found or is not accessible to this linked account.`;
  }

  if (status) {
    return `AcornOps ${label} could not be loaded (HTTP ${status}). Try again later or check the bot logs.`;
  }

  return `AcornOps ${label} could not be loaded. Try again later or check the bot logs.`;
}

export function chatMessageErrorText(error, toolAccessMode = "read_only") {
  const status = httpStatusFromError(error);
  const modeLabel = toolAccessMode === "read_write" ? "read-write" : "read-only";
  if (status === 400) {
    const details = acornOpsErrorDetails(error);
    const reason = [details.code, details.message].filter(Boolean).join(": ");
    if (reason) {
      return `AcornOps could not start the ${modeLabel} chat run (${reason}). Reply in this thread to try again, or use \`!chat end\` to close it.`;
    }

    return `AcornOps could not start the ${modeLabel} chat run (HTTP 400). Reply in this thread to try again, or use \`!chat end\` to close it; check the AcornOps logs for the rejected request reason.`;
  }

  if (status === 403 && toolAccessMode === "read_write") {
    return "AcornOps did not allow a read-write run for your linked account in this workspace. The integration configuration, workspace grant, or workspace role may no longer permit it. Start a read-only chat with `!chat new` if needed.";
  }

  return dataErrorText(error, "chat message");
}

export function workflowMessageErrorText(error) {
  const status = httpStatusFromError(error);
  if (status === 400) {
    const details = acornOpsErrorDetails(error);
    const reason = [details.code, details.message].filter(Boolean).join(": ");
    if (reason) {
      return `AcornOps could not start the workflow run (${reason}).`;
    }
    return "AcornOps could not start the workflow run (HTTP 400). Check the AcornOps logs for the rejected request reason.";
  }

  return dataErrorText(error, "workflow");
}

function httpStatusFromError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const match = /\bfailed with (\d{3})\b/.exec(message);
  return match ? Number(match[1]) : null;
}

function acornOpsErrorDetails(error) {
  const message = error instanceof Error ? error.message : String(error);
  const match = /\bfailed with \d{3}:\s*([\s\S]*)$/.exec(message);
  if (!match) {
    return {};
  }

  const text = match[1].trim();
  if (!text) {
    return {};
  }

  try {
    const parsed = JSON.parse(text);
    const detail = parsed.error && typeof parsed.error === "object" ? parsed.error : parsed;
    return {
      code: singleLine(detail.code ?? ""),
      message: singleLine(detail.message ?? "")
    };
  } catch {
    return {
      message: singleLine(text)
    };
  }
}
