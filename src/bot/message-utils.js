import { DEFAULT_MATTERMOST_BOT_USERNAME } from "./config.js";

export function firstCommandWord(text) {
  return text.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
}

export function normalizeBotText(text, botUsername = DEFAULT_MATTERMOST_BOT_USERNAME) {
  const trimmed = text.trim();
  const mentionPattern = new RegExp(`^@${escapeRegExp(botUsername)}\\b[:,]?\\s*`, "i");

  return trimmed.replace(mentionPattern, "").trim();
}

export function parseMentions(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string" || !value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function identityLabel({ userId, userName }) {
  if (userName && userId) {
    return `${userName} (${userId})`;
  }

  return userName || userId || "unknown";
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
