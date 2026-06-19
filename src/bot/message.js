import { DEFAULT_MATTERMOST_BOT_USERNAME } from "./config.js";
import {
  createNullCommandContextStore,
  resolveWorkspaceReference
} from "./command-context.js";
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
  "- `status` checks whether this external chat account is linked to AcornOps.",
  "- `workspaces` lists AcornOps workspaces available to your linked account.",
  "- `workspaces 1` shows details for a workspace.",
  "- `workspace` shows details for the current workspace.",
  "- `workspace 1` changes the current workspace.",
  "- `clusters` lists clusters in the current workspace."
].join("\n");

const nullCommandContextStore = createNullCommandContextStore();

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
  commandContextStore = nullCommandContextStore,
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
      commandContextStore,
      mattermostIdentity
    });
  }

  if (action === "workspace") {
    return handleWorkspace({
      commandArgs,
      userId,
      userName,
      channelType,
      acornOpsClient,
      commandContextStore,
      mattermostIdentity
    });
  }

  if (action === "clusters") {
    return handleClusters({
      commandArgs,
      userId,
      channelType,
      acornOpsClient,
      commandContextStore,
      mattermostIdentity
    });
  }

  return `Unknown AcornOps bot command: ${action}\n\n${helpText}`;
}

async function handleLogin({ userId, userName, acornOpsClient, mattermostIdentity }) {
  if (!isAcornOpsChatAuthConfigured(acornOpsClient)) {
    return "AcornOps login is not configured. Set `ACORNOPS_API_BASE_URL` and `EXTERNAL_INTEGRATION_SERVICE_TOKEN`, then restart the bot.";
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
    return "AcornOps status is not configured. Set `ACORNOPS_API_BASE_URL` and `EXTERNAL_INTEGRATION_SERVICE_TOKEN`, then restart the bot.";
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
  commandContextStore,
  mattermostIdentity
}) {
  if (commandArgs.length > 1) {
    return "`/workspaces` accepts at most one workspace number or id.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    mattermostIdentity,
    userId,
    commandLabel: "workspaces"
  });
  if (auth.response) {
    return auth.response;
  }

  if (commandArgs.length === 1) {
    return handleWorkspaceDetail({
      reference: commandArgs[0],
      userId,
      userName,
      identity: auth.identity,
      acornOpsClient,
      commandContextStore,
      selectCurrent: false
    });
  }

  try {
    const page = await acornOpsClient.listWorkspaces(auth.identity);
    commandContextStore.rememberWorkspaces(auth.identity.externalUserId, page.items ?? []);
    return formatWorkspacePage({
      page,
      userId,
      userName
    });
  } catch (error) {
    return workspaceErrorText(error);
  }
}

async function handleWorkspace({
  commandArgs,
  userId,
  userName,
  channelType,
  acornOpsClient,
  commandContextStore,
  mattermostIdentity
}) {
  if (commandArgs.length > 1) {
    return "`/workspace` accepts at most one workspace number or id.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    mattermostIdentity,
    userId,
    commandLabel: "workspace"
  });
  if (auth.response) {
    return auth.response;
  }

  if (commandArgs.length === 0) {
    const currentWorkspace = commandContextStore.get(auth.identity.externalUserId).currentWorkspace;
    if (!currentWorkspace) {
      return "No current workspace is selected. Send `/workspaces`, then `/workspace 1`.";
    }

    return handleWorkspaceDetail({
      reference: currentWorkspace.id,
      userId,
      userName,
      identity: auth.identity,
      acornOpsClient,
      commandContextStore,
      selectCurrent: false,
      currentPrefix: true
    });
  }

  return handleWorkspaceDetail({
    reference: commandArgs[0],
    userId,
    userName,
    identity: auth.identity,
    acornOpsClient,
    commandContextStore,
    selectCurrent: true
  });
}

async function handleWorkspaceDetail({
  reference,
  userId,
  userName,
  identity,
  acornOpsClient,
  commandContextStore,
  selectCurrent,
  currentPrefix = false
}) {
  const workspace = resolveWorkspaceForUser({
    reference,
    identity,
    commandContextStore
  });
  if (!workspace) {
    return "I do not have that workspace number yet. Send `/workspaces` first, or use a workspace id.";
  }

  try {
    const detail = await acornOpsClient.getWorkspace(identity, workspace.id);
    if (selectCurrent) {
      commandContextStore.selectWorkspace(identity.externalUserId, detail);
    }
    return formatWorkspaceDetail({
      workspace: detail,
      userId,
      userName,
      selectCurrent,
      currentPrefix
    });
  } catch (error) {
    return workspaceErrorText(error);
  }
}

async function handleClusters({
  commandArgs,
  userId,
  channelType,
  acornOpsClient,
  commandContextStore,
  mattermostIdentity
}) {
  if (commandArgs.length > 1) {
    return "`/clusters` accepts at most one workspace number or id.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    mattermostIdentity,
    userId,
    commandLabel: "clusters"
  });
  if (auth.response) {
    return auth.response;
  }

  const workspace = resolveWorkspaceForUser({
    reference: commandArgs[0] ?? "",
    identity: auth.identity,
    commandContextStore
  });
  if (!workspace) {
    return "No current workspace is selected. Send `/workspaces`, then `/workspace 1` or `/clusters 1`.";
  }

  try {
    const page = await acornOpsClient.listKubernetesClusters(auth.identity, workspace.id);
    commandContextStore.selectWorkspace(auth.identity.externalUserId, workspace);
    return formatClusterPage({
      page,
      workspace
    });
  } catch (error) {
    return clusterErrorText(error);
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

  for (const [index, workspace] of items.entries()) {
    lines.push(`${index + 1}. ${formatWorkspaceSummary(workspace)}`);
  }

  if (page.nextCursor) {
    lines.push(`Next page cursor: ${page.nextCursor}`);
  }

  lines.push("Use `/workspaces 1` for details or `/workspace 1` to set the current workspace.");

  return lines.join("\n");
}

function formatWorkspaceDetail({ workspace, userId, userName, selectCurrent, currentPrefix }) {
  const lines = [
    currentPrefix ? "Current AcornOps workspace:" : "AcornOps workspace:",
    `- Name: ${workspace.name ?? workspace.displayName ?? workspace.slug ?? "Unnamed workspace"}`,
    `- ID: ${workspace.id ?? "unknown"}`,
    `- Mattermost user: ${identityLabel({ userId, userName })}`
  ];

  const plan = workspace.plan?.name ?? workspace.plan?.key ?? "";
  if (plan) {
    lines.push(`- Plan: ${plan}`);
  }

  const permissions = formatPermissions(workspace.permissions);
  if (permissions) {
    lines.push(`- Permissions: ${permissions}`);
  }

  const counts = formatCounts(workspace.counts ?? workspace.listCounts ?? workspace.boundedListCounts);
  if (counts) {
    lines.push(`- Counts: ${counts}`);
  }

  const quota = formatWorkspaceQuota(workspace.quota);
  if (quota) {
    lines.push(`- Quota: ${quota}`);
  }

  if (selectCurrent) {
    lines.push("Current workspace updated. Use `/clusters` to list clusters here.");
  } else if (!currentPrefix) {
    lines.push("Use `/workspace 1` to make this the current workspace.");
  } else {
    lines.push("Use `/clusters` to list clusters in this workspace.");
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

function formatPermissions(permissions) {
  if (!permissions || typeof permissions !== "object") {
    return "";
  }

  const enabled = Object.entries(permissions)
    .filter(([, value]) => value === true)
    .map(([key]) => key);

  return enabled.length > 0 ? enabled.join(", ") : "none";
}

function formatCounts(counts) {
  if (!counts || typeof counts !== "object") {
    return "";
  }

  return Object.entries(counts)
    .filter(([, value]) => typeof value === "number" || typeof value === "string")
    .map(([key, value]) => `${key} ${value}`)
    .join(", ");
}

function formatClusterPage({ page, workspace }) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const lines = [
    `AcornOps clusters in ${formatWorkspaceReference(workspace)}:`
  ];

  if (items.length === 0) {
    lines.push("- No clusters are available in this workspace.");
    return lines.join("\n");
  }

  for (const [index, cluster] of items.entries()) {
    lines.push(`${index + 1}. ${formatClusterSummary(cluster)}`);
  }

  if (page.nextCursor) {
    lines.push(`Next page cursor: ${page.nextCursor}`);
  }

  return lines.join("\n");
}

function formatClusterSummary(cluster) {
  const name = cluster.name ?? cluster.displayName ?? cluster.slug ?? cluster.id ?? "Unnamed cluster";
  const id = cluster.id && cluster.id !== name ? ` (${cluster.id})` : "";
  const details = [
    formatField("status", cluster.status),
    formatField("agent", cluster.agentState),
    formatField("version", cluster.kubernetesVersion ?? cluster.version),
    formatField("provider", cluster.provider),
    formatField("region", cluster.region)
  ].filter(Boolean);

  if (details.length === 0) {
    return `${name}${id}`;
  }

  return `${name}${id} - ${details.join(", ")}`;
}

function formatField(label, value) {
  return value ? `${label}: ${value}` : "";
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
      "AcornOps workspaces could not be loaded because this external chat account is not linked or the bot credentials are invalid.",
      "Run `/login` in a direct message, then try `/workspaces` again."
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

function clusterErrorText(error) {
  const status = httpStatusFromError(error);
  if (status === 401) {
    return [
      "AcornOps clusters could not be loaded because this external chat account is not linked or the bot credentials are invalid.",
      "Run `/login` in a direct message, then try `/clusters` again."
    ].join("\n");
  }

  if (status === 404) {
    return "AcornOps workspace could not be found or is not accessible to this linked account.";
  }

  if (status) {
    return `AcornOps clusters could not be loaded (HTTP ${status}). Try again later or check the bot logs.`;
  }

  return "AcornOps clusters could not be loaded. Try again later or check the bot logs.";
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
    externalUserId: mattermostIdentity?.externalUserId ?? userId
  };

  if (!identity.externalUserId) {
    return null;
  }

  return identity;
}

function requireExternalDataCommand({
  channelType,
  acornOpsClient,
  mattermostIdentity,
  userId,
  commandLabel
}) {
  if (channelType !== "D") {
    return {
      response: `For ${commandLabel} details, send me a direct message with \`/${commandLabel}\`.`
    };
  }

  if (!isAcornOpsChatAuthConfigured(acornOpsClient)) {
    const verb = commandLabel === "workspaces" ? "are" : "is";
    return {
      response: `AcornOps ${commandLabel} ${verb} not configured. Set \`ACORNOPS_API_BASE_URL\` and \`EXTERNAL_INTEGRATION_SERVICE_TOKEN\`, then restart the bot.`
    };
  }

  const identity = normalizeMattermostIdentity({ mattermostIdentity, userId });
  if (!identity) {
    return {
      response: missingIdentityText()
    };
  }

  return { identity };
}

function resolveWorkspaceForUser({ reference, identity, commandContextStore }) {
  const context = commandContextStore.get(identity.externalUserId);
  return resolveWorkspaceReference(reference, context);
}

function formatWorkspaceReference(workspace) {
  if (!workspace) {
    return "unknown workspace";
  }

  if (workspace.name && workspace.id) {
    return `${workspace.name} (${workspace.id})`;
  }

  return workspace.name || workspace.id || "unknown workspace";
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
