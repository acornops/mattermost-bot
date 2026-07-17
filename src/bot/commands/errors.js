import { singleLine } from "./formatters.js";

export function workspaceErrorText(error) {
  const status = httpStatusFromError(error);
  if (status === 401) {
    return [
      "I couldn’t access AcornOps workspaces for this account.",
      "Send `!status` to check the connection. If it is not linked, send `!login` in a direct message."
    ].join("\n");
  }

  if (status === 404) {
    return "AcornOps workspace could not be found or is not accessible to this linked account.";
  }

  if (status) {
    return "AcornOps workspaces are temporarily unavailable. Try again later.";
  }

  return "AcornOps workspaces are temporarily unavailable. Try again later.";
}

export function dataErrorText(error, label) {
  const status = httpStatusFromError(error);
  if (status === 401) {
    return [
      `I couldn’t access AcornOps ${label} for this account.`,
      "Send `!status` to check the connection. If it is not linked, send `!login` in a direct message."
    ].join("\n");
  }

  if (status === 403) {
    return `AcornOps ${label} are not permitted for this linked account.`;
  }

  if (status === 404) {
    return `AcornOps ${label} could not be found or is not accessible to this linked account.`;
  }

  if (status) {
    return `AcornOps ${label} are temporarily unavailable. Try again later.`;
  }

  return `AcornOps ${label} are temporarily unavailable. Try again later.`;
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

    return `AcornOps could not start the ${modeLabel} chat run. Reply in this thread to try again, or use \`!chat end\` to close it.`;
  }

  if (status === 403 && toolAccessMode === "read_write") {
    return "Read-write access is no longer available for this account in the current workspace. You can start a read-only chat with `!chat new`.";
  }

  return dataErrorText(error, "chat message");
}

export function workflowMessageErrorText(error) {
  const status = httpStatusFromError(error);
  if (status === 400 || status === 409) {
    const details = acornOpsErrorDetails(error);
    const reason = [details.code, details.message].filter(Boolean).join(": ");
    if (reason) {
      return `AcornOps could not start the workflow run (${reason}).`;
    }
    return "AcornOps could not start the workflow. Review its inputs or try again later.";
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
