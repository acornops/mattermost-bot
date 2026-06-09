const helpText = [
  "AcornOps bot commands:",
  "- `help` shows this help.",
  "- `login` creates an AcornOps account-link URL.",
  "- `status` checks whether this Mattermost account is linked to AcornOps.",
  "- `clusters` will list accessible clusters once the backend API exists."
].join("\n");

function firstWord(text) {
  return text.trim().split(/\s+/, 1)[0]?.toLowerCase().replace(/^\/+/, "") ?? "";
}

export function normalizeBotText(text, botUsername = "acorn-ops-bot") {
  const trimmed = text.trim();
  const mentionPattern = new RegExp(`^@${escapeRegExp(botUsername)}\\b[:,]?\\s*`, "i");

  return trimmed.replace(mentionPattern, "").trim();
}

export function shouldRespondToPost({ post, botUserId, botUsername = "acorn-ops-bot", channelType = "" }) {
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

export async function handleBotMessage({
  text,
  userId = "",
  userName = "",
  botUsername = "acorn-ops-bot",
  channelType = "",
  acornOpsClient = null,
  mattermostIdentity = null
}) {
  const normalizedText = normalizeBotText(text, botUsername);
  const action = firstWord(normalizedText) || "help";

  if (action === "help") {
    return helpText;
  }

  if (action === "login") {
    if (channelType !== "D") {
      return `For account login, send me a direct message with \`login\`.`;
    }

    return handleLogin({ userId, userName, acornOpsClient, mattermostIdentity });
  }

  if (action === "status") {
    return handleStatus({ userId, userName, acornOpsClient, mattermostIdentity });
  }

  if (action === "clusters") {
    return "Cluster listing placeholder. The backend cluster-management API is not connected yet.";
  }

  return `Unknown AcornOps bot command: ${action}\n\n${helpText}`;
}

async function handleLogin({ userId, userName, acornOpsClient, mattermostIdentity }) {
  if (!acornOpsClient) {
    return "AcornOps login is not configured. Set `ACORNOPS_API_BASE_URL` and `MATTERMOST_CHAT_SERVICE_TOKEN`, then restart the bot.";
  }

  const identity = normalizeMattermostIdentity({ mattermostIdentity, userId });
  if (!identity) {
    return missingIdentityText();
  }

  const link = await acornOpsClient.createMattermostLink(identity);
  return [
    "AcornOps account link:",
    link.linkUrl,
    "",
    `Mattermost user: ${identityLabel({ userId, userName })}`,
    "This link expires in 10 minutes.",
    "No AcornOps password should be typed into Mattermost."
  ].join("\n");
}

async function handleStatus({ userId, userName, acornOpsClient, mattermostIdentity }) {
  if (!acornOpsClient) {
    return "AcornOps status is not configured. Set `ACORNOPS_API_BASE_URL` and `MATTERMOST_CHAT_SERVICE_TOKEN`, then restart the bot.";
  }

  const identity = normalizeMattermostIdentity({ mattermostIdentity, userId });
  if (!identity) {
    return missingIdentityText();
  }

  const result = await acornOpsClient.resolveMattermostLink(identity);
  if (result.status === "linked") {
    const user = result.user ?? {};
    const linkedUser = [user.displayName, user.email, user.id].filter(Boolean).join(" / ");
    return [
      "AcornOps bot status:",
      `- Mattermost user: ${identityLabel({ userId, userName })}`,
      `- Backend authentication: linked to AcornOps${linkedUser ? ` as ${linkedUser}` : ""}`,
      "- Cluster access: not loaded"
    ].join("\n");
  }

  if (result.status === "unlinked") {
    return [
      "AcornOps bot status:",
      `- Mattermost user: ${identityLabel({ userId, userName })}`,
      "- Backend authentication: not linked. Run `login` to connect AcornOps.",
      "- Cluster access: not loaded"
    ].join("\n");
  }

  return [
    "AcornOps bot status:",
    `- Mattermost user: ${identityLabel({ userId, userName })}`,
    `- Backend authentication: unknown AcornOps status ${JSON.stringify(result.status)}`,
    "- Cluster access: not loaded"
  ].join("\n");
}

function missingIdentityText() {
  return [
    "AcornOps account linking is unavailable because Mattermost did not provide the required identity context.",
    "Required identity fields: server id, team id, and user id."
  ].join("\n");
}

function normalizeMattermostIdentity({ mattermostIdentity, userId }) {
  const identity = {
    mattermostServerId: mattermostIdentity?.mattermostServerId ?? "",
    mattermostTeamId: mattermostIdentity?.mattermostTeamId ?? "",
    mattermostUserId: mattermostIdentity?.mattermostUserId ?? userId
  };

  if (!identity.mattermostServerId || !identity.mattermostTeamId || !identity.mattermostUserId) {
    return null;
  }

  return identity;
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
