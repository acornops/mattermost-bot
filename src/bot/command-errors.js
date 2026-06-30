import { singleLine } from "./command-formatters.js";

export function workspaceErrorText(error) {
  const status = httpStatusFromError(error);
  if (status === 401) {
    return [
      "AcornOps workspaces could not be loaded because this external chat account is not linked or the bot credentials are invalid.",
      "Run `login` in a direct message, then try `workspaces` again."
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
      "Run `login` in a direct message, then try again."
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

export function chatMessageErrorText(error) {
  const status = httpStatusFromError(error);
  if (status === 400) {
    const details = acornOpsErrorDetails(error);
    const reason = [details.code, details.message].filter(Boolean).join(": ");
    if (reason) {
      return `AcornOps could not start the read-only chat run (${reason}). Use \`chat pause\` before running bot commands like \`status\`, \`resources\`, or \`findings\`.`;
    }

    return "AcornOps could not start the read-only chat run (HTTP 400). Use `chat pause` before running bot commands like `status`, `resources`, or `findings`; check the AcornOps logs for the rejected request reason.";
  }

  return dataErrorText(error, "chat message");
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
