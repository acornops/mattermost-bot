import { mattermostDevLoginEmail } from "./acornops-client.js";

const helpText = [
  "AcornOps bot commands:",
  "- `help` shows this help.",
  "- `login` signs this Mattermost user into the local AcornOps backend.",
  "- `status` shows the local chat identity and backend auth state.",
  "- `clusters` will list accessible clusters once the backend API exists."
].join("\n");

function firstWord(text) {
  return text.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
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
  authStore = null
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

    return await handleLogin({ userId, userName, acornOpsClient, authStore });
  }

  if (action === "status") {
    const session = authStore?.get?.(userId);
    return [
      "AcornOps bot status:",
      `- Mattermost user: ${identityLabel({ userId, userName })}`,
      `- Backend authentication: ${session ? `connected as ${session.user.displayName} (${session.user.id})` : "not connected"}`,
      "- Cluster access: not loaded"
    ].join("\n");
  }

  if (action === "clusters") {
    return "Cluster listing placeholder. The backend cluster-management API is not connected yet.";
  }

  return `Unknown AcornOps bot command: ${action}\n\n${helpText}`;
}

async function handleLogin({ userId, userName, acornOpsClient, authStore }) {
  if (!acornOpsClient) {
    return "AcornOps login is not configured. Set `CSIT_ACORNOPS_URL` and restart the bot.";
  }

  const email = mattermostDevLoginEmail(userId);
  const name = userName || userId || "Mattermost User";
  let result;

  try {
    result = await acornOpsClient.devLogin({ email, name });
  } catch (error) {
    return [
      "AcornOps login failed.",
      error instanceof Error ? error.message : String(error)
    ].join("\n");
  }

  authStore?.set?.(userId, {
    user: result.user,
    mode: result.mode,
    sessionCookie: result.sessionCookie
  });

  return [
    "AcornOps login complete.",
    `Mattermost user: ${identityLabel({ userId, userName })}`,
    `AcornOps user: ${result.user.displayName} (${result.user.id})`,
    `AcornOps email: ${result.user.email}`
  ].join("\n");
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
