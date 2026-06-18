import { DEFAULT_MATTERMOST_BOT_USERNAME } from "./config.js";
import {
  escapeRegExp,
  firstCommandWord,
  identityLabel,
  normalizeBotText,
  parseMentions
} from "./message-utils.js";

const helpText = [
  "AcornOps bot commands:",
  "- `help` shows this help.",
  "- `login` creates an AcornOps account-link URL.",
  "- `status` checks whether this Mattermost account is linked to AcornOps.",
  "- `workspaces` lists AcornOps workspaces available to your linked account.",
  "- `clusters` will list accessible clusters once the backend API exists."
].join("\n");

export { normalizeBotText } from "./message-utils.js";

export function shouldRespondToPost({
  post,
  botUserId,
  botUsername = DEFAULT_MATTERMOST_BOT_USERNAME,
  channelType = ""
}) {
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
  botUsername = DEFAULT_MATTERMOST_BOT_USERNAME,
  channelType = "",
  acornOpsClient = null,
  mattermostIdentity = null
}) {
  const normalizedText = normalizeBotText(text, botUsername);
  const action = firstCommandWord(normalizedText) || "help";
  const commandArgs = commandArguments(normalizedText);

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

  if (action === "workspaces") {
    return handleWorkspaces({
      commandArgs,
      userId,
      userName,
      channelType,
      acornOpsClient,
      mattermostIdentity
    });
  }

  if (action === "clusters") {
    return "Cluster listing placeholder. The backend cluster-management API is not connected yet.";
  }

  return `Unknown AcornOps bot command: ${action}\n\n${helpText}`;
}

async function handleLogin({ userId, userName, acornOpsClient, mattermostIdentity }) {
  if (!isAcornOpsChatAuthConfigured(acornOpsClient)) {
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
  if (!isAcornOpsChatAuthConfigured(acornOpsClient)) {
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
      "- Backend authentication: not linked. Run `/login` to connect AcornOps.",
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

async function handleWorkspaces({
  commandArgs,
  userId,
  userName,
  channelType,
  acornOpsClient,
  mattermostIdentity
}) {
  if (commandArgs.length > 0) {
    return "`/workspaces` does not accept arguments yet. Send `/workspaces` by itself.";
  }

  if (channelType !== "D") {
    return "For workspace listings, send me a direct message with `/workspaces`.";
  }

  if (!isAcornOpsChatAuthConfigured(acornOpsClient)) {
    return "AcornOps workspaces are not configured. Set `ACORNOPS_API_BASE_URL` and `MATTERMOST_CHAT_SERVICE_TOKEN`, then restart the bot.";
  }

  const identity = normalizeMattermostIdentity({ mattermostIdentity, userId });
  if (!identity) {
    return missingIdentityText();
  }

  try {
    const page = await acornOpsClient.listWorkspaces(identity);
    return formatWorkspacePage({
      page,
      userId,
      userName
    });
  } catch (error) {
    return workspaceErrorText(error);
  }
}

function formatWorkspacePage({ page, userId, userName }) {
  const items = Array.isArray(page?.items) ? page.items : [];
  if (items.length === 0) {
    return [
      "AcornOps workspaces:",
      `- Mattermost user: ${identityLabel({ userId, userName })}`,
      "- No workspaces are available for this linked account."
    ].join("\n");
  }

  const lines = [
    "AcornOps workspaces:",
    `Mattermost user: ${identityLabel({ userId, userName })}`
  ];

  for (const workspace of items) {
    lines.push(`- ${formatWorkspaceSummary(workspace)}`);
  }

  if (page.nextCursor) {
    lines.push(`Next page cursor: ${page.nextCursor}`);
  }

  return lines.join("\n");
}

function formatWorkspaceSummary(workspace) {
  const name = workspace.name ?? workspace.displayName ?? workspace.slug ?? workspace.id ?? "Unnamed workspace";
  const id = workspace.id && workspace.id !== name ? ` (${workspace.id})` : "";
  const plan = workspace.plan?.name ?? workspace.plan?.key ?? "";
  const quota = formatWorkspaceQuota(workspace.quota);
  const parts = [`${name}${id}`];

  if (plan) {
    parts.push(`plan: ${plan}`);
  }
  if (quota) {
    parts.push(`quota: ${quota}`);
  }

  return parts.join(" | ");
}

function formatWorkspaceQuota(quota) {
  if (!quota || typeof quota !== "object") {
    return "";
  }

  return [
    formatQuotaValue("members", quota.members),
    formatQuotaValue("clusters", quota.kubernetesClusters),
    formatQuotaValue("VMs", quota.virtualMachines)
  ].filter(Boolean).join(", ");
}

function formatQuotaValue(label, quota) {
  if (!quota || typeof quota !== "object") {
    return "";
  }

  const used = quota.used ?? 0;
  const limit = quota.limit ?? "unlimited";
  return `${label} ${used}/${limit}`;
}

function workspaceErrorText(error) {
  const status = httpStatusFromError(error);
  if (status === 401) {
    return [
      "AcornOps workspaces could not be loaded because this Mattermost account is not linked or the bot credentials are invalid.",
      "Run `/login` in a direct message, then try `/workspaces` again."
    ].join("\n");
  }

  if (status) {
    return `AcornOps workspaces could not be loaded (HTTP ${status}). Try again later or check the bot logs.`;
  }

  return "AcornOps workspaces could not be loaded. Try again later or check the bot logs.";
}

function httpStatusFromError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const match = /\bfailed with (\d{3})\b/.exec(message);
  return match ? Number(match[1]) : null;
}

function missingIdentityText() {
  return [
    "AcornOps account linking is unavailable because Mattermost did not provide the required identity context.",
    "Required identity field: user id."
  ].join("\n");
}

function commandArguments(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  return trimmed.split(/\s+/).slice(1);
}

function normalizeMattermostIdentity({ mattermostIdentity, userId }) {
  const identity = {
    mattermostUserId: mattermostIdentity?.mattermostUserId ?? userId
  };

  if (!identity.mattermostUserId) {
    return null;
  }

  return identity;
}

function isAcornOpsChatAuthConfigured(acornOpsClient) {
  if (!acornOpsClient) {
    return false;
  }

  if (typeof acornOpsClient.canUseMattermostChatAuth !== "function") {
    return true;
  }

  return acornOpsClient.canUseMattermostChatAuth();
}
