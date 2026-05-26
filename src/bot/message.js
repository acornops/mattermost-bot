const helpText = [
  "CSIT commands:",
  "- `help` shows this help.",
  "- `login` starts the backend authentication flow once the API exists.",
  "- `status` shows the local chat identity and mocked auth state.",
  "- `clusters` will list accessible clusters once the backend API exists."
].join("\n");

function firstWord(text) {
  return text.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
}

export function normalizeBotText(text, botUsername = "csit") {
  const trimmed = text.trim();
  const mentionPattern = new RegExp(`^@${escapeRegExp(botUsername)}\\b[:,]?\\s*`, "i");

  return trimmed.replace(mentionPattern, "").trim();
}

export function shouldRespondToPost({ post, botUserId, botUsername = "csit", channelType = "" }) {
  if (!post || post.user_id === botUserId) {
    return false;
  }

  if (channelType === "D") {
    return true;
  }

  const mentions = parseMentions(post.props?.mentions ?? post.metadata?.mentions);
  if (mentions.includes(botUserId)) {
    return true;
  }

  return new RegExp(`(^|\\s)@${escapeRegExp(botUsername)}\\b`, "i").test(post.message ?? "");
}

export function handleBotMessage({ text, userId = "", userName = "", botUsername = "csit" }) {
  const normalizedText = normalizeBotText(text, botUsername);
  const action = firstWord(normalizedText) || "help";

  if (action === "help") {
    return helpText;
  }

  if (action === "login") {
    return [
      "Login flow placeholder.",
      "The backend API contract is pending, so no external authentication request was sent yet.",
      `Mattermost user: ${identityLabel({ userId, userName })}`
    ].join("\n");
  }

  if (action === "status") {
    return [
      "CSIT status:",
      `- Mattermost user: ${identityLabel({ userId, userName })}`,
      "- Backend authentication: not connected",
      "- Cluster access: not loaded"
    ].join("\n");
  }

  if (action === "clusters") {
    return "Cluster listing placeholder. The backend cluster-management API is not connected yet.";
  }

  return `Unknown CSIT command: ${action}\n\n${helpText}`;
}

function identityLabel({ userId, userName }) {
  if (userName && userId) {
    return `${userName} (${userId})`;
  }

  return userName || userId || "unknown";
}

function parseMentions(value) {
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
