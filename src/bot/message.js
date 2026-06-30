import { DEFAULT_MATTERMOST_BOT_USERNAME } from "./config.js";
import {
  createNullCommandContextStore,
  resolveClusterReference,
  resolveSessionReference,
  resolveTargetReference,
  resolveVirtualMachineReference,
  resolveWorkspaceReference
} from "./command-context.js";
import {
  escapeRegExp,
  firstCommandWord,
  identityLabel,
  normalizeBotText,
  parseMentions
} from "./message-utils.js";
import {
  formatChatStatus,
  formatClusterDetail,
  formatClusterPage,
  formatContextLines,
  formatFindingPage,
  formatMessagePage,
  formatReference,
  formatResourcePage,
  formatSessionDetail,
  formatSessionPage,
  formatTargetDetail,
  formatTargetPage,
  formatVirtualMachineDetail,
  formatVirtualMachinePage,
  formatWorkspaceDetail,
  formatWorkspacePage,
  normalizeListResponse,
  normalizeTargetType,
} from "./command-formatters.js";
import {
  commandArguments,
  parseListArgs,
  parseTargetFilterArgs
} from "./command-args.js";
import {
  chatMessageErrorText,
  dataErrorText,
  workspaceErrorText
} from "./command-errors.js";
import {
  activeRunResponseText,
  chatClientMessageId,
  followRunForAnswer,
  formatChatPendingResponse
} from "./chat-runs.js";

const commandReferenceUrl = "https://github.com/acornops/mattermost-bot/wiki/Mattermost-Bot-Commands";

const helpText = [
  "AcornOps commands:",
  "Flow: `login` -> `workspaces` -> `workspace 1` -> `targets` -> `target 1` -> `chat new`.",
  "",
  "Common commands:",
  "- `login` connects your Mattermost account to AcornOps.",
  "- `status` shows account and current context.",
  "- `workspaces` lists workspaces; `workspace 1` selects one.",
  "- `targets` lists Kubernetes and VM targets; `target 1` selects one.",
  "- `resources`, `findings`, and `investigations` inspect the selected context.",
  "- `chat new` starts a read-only AcornOps chat for the selected target.",
  "- `chat pause`, `chat resume`, and `chat end` control chat mode.",
  "- `help filters` shows common filters.",
  "",
  `More commands, filters, and examples: ${commandReferenceUrl}`
].join("\n");

const filterHelpText = [
  "AcornOps filter examples:",
  "- `workspaces q=platform`",
  "- `targets q=prod targetType=kubernetes`",
  "- `resources kind=Pod namespace=payments health=attention`",
  "- `findings severity=critical namespace=payments`",
  "- `investigations severity=warning clusterId=cluster-id namespace=default`",
  "",
  "Supported filters:",
  "- `workspaces`: `q`",
  "- `targets`: `q`, `targetType=kubernetes|virtual_machine`",
  "- `resources`: `q`, `kind`, `family=workloads|network|storage|cluster`, `namespace`, `health=healthy|attention`",
  "- `findings`: `q`, `severity=critical|warning|info`, `namespace`",
  "- `investigations`: `q`, `severity=critical|warning|info`, `clusterId`, `namespace`",
  "",
  `Full reference: ${commandReferenceUrl}`
].join("\n");

const nullCommandContextStore = createNullCommandContextStore();

class CommandResponseError extends Error {}

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

export async function handleBotMessage(options) {
  return botResponseText(await handleBotMessageResult(options));
}

export function botResponseText(result) {
  return typeof result === "string" ? result : result.message;
}

export async function handleBotMessageResult({
  text,
  userId = "",
  userName = "",
  botUsername = DEFAULT_MATTERMOST_BOT_USERNAME,
  channelType = "",
  acornOpsClient = null,
  commandContextStore = nullCommandContextStore,
  sourceMessageId = ""
}) {
  const normalizedText = normalizeBotText(text, botUsername);
  const action = firstCommandWord(normalizedText) || "help";
  const commandArgs = commandArguments(normalizedText);

  if (action.startsWith("/")) {
    return "Commands do not use `/`. Try the command again without the slash, for example `clusters`.";
  }

  const chatModeRoute = activeChatModeRoute({
    action,
    commandArgs,
    normalizedText,
    userId,
    commandContextStore
  });
  if (chatModeRoute.asQuestion) {
    return handleChatQuestion({
      question: normalizedText,
      userId,
      userName,
      channelType,
      acornOpsClient,
      commandContextStore,
      sourceMessageId
    });
  }

  if (action === "help") {
    if (commandArgs[0] === "filters") {
      return filterHelpText;
    }
    return helpText;
  }

  if (action === "filters") {
    return filterHelpText;
  }

  if (action === "login") {
    if (channelType !== "D") {
      return `For account login, send me a direct message with \`login\`.`;
    }

    return handleLogin({ userId, userName, acornOpsClient });
  }

  if (action === "status") {
    return handleStatus({
      userId,
      userName,
      acornOpsClient,
      commandContextStore,
    });
  }

  if (action === "workspaces") {
    return handleWorkspaces({
      commandArgs,
      userId,
      userName,
      channelType,
      acornOpsClient,
      commandContextStore,
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
    });
  }

  if (action === "targets") {
    return handleTargets({
      commandArgs,
      userId,
      userName,
      channelType,
      acornOpsClient,
      commandContextStore,
    });
  }

  if (action === "target") {
    return handleTarget({
      commandArgs,
      userId,
      userName,
      channelType,
      acornOpsClient,
      commandContextStore,
    });
  }

  if (action === "clusters") {
    return handleClusters({
      commandArgs,
      userId,
      userName,
      channelType,
      acornOpsClient,
      commandContextStore,
    });
  }

  if (action === "cluster") {
    return handleCluster({
      commandArgs,
      userId,
      userName,
      channelType,
      acornOpsClient,
      commandContextStore,
    });
  }

  if (action === "resources") {
    return handleResources({
      commandArgs,
      userId,
      userName,
      channelType,
      acornOpsClient,
      commandContextStore,
    });
  }

  if (action === "findings") {
    return handleFindings({
      commandArgs,
      userId,
      userName,
      channelType,
      acornOpsClient,
      commandContextStore,
    });
  }

  if (action === "investigations") {
    return handleInvestigations({
      commandArgs,
      userId,
      userName,
      channelType,
      acornOpsClient,
      commandContextStore,
    });
  }

  if (action === "vms") {
    return handleVirtualMachines({
      commandArgs,
      userId,
      userName,
      channelType,
      acornOpsClient,
      commandContextStore,
    });
  }

  if (action === "vm") {
    return handleVirtualMachine({
      commandArgs,
      userId,
      userName,
      channelType,
      acornOpsClient,
      commandContextStore,
    });
  }

  if (action === "sessions") {
    return handleSessions({
      commandArgs,
      userId,
      userName,
      channelType,
      acornOpsClient,
      commandContextStore,
    });
  }

  if (action === "session") {
    return handleSession({
      commandArgs,
      userId,
      userName,
      channelType,
      acornOpsClient,
      commandContextStore,
    });
  }

  if (action === "chat") {
    return handleChat({
      commandArgs,
      userId,
      userName,
      channelType,
      acornOpsClient,
      commandContextStore,
    });
  }

  if (action === "messages") {
    return handleMessages({
      commandArgs,
      userId,
      userName,
      channelType,
      acornOpsClient,
      commandContextStore,
    });
  }

  if (action === "ask") {
    return handleChatQuestion({
      question: normalizedText.replace(/^ask\s+/i, "").trim(),
      userId,
      userName,
      channelType,
      acornOpsClient,
      commandContextStore,
    });
  }

  return `Unknown AcornOps bot command: ${action}\n\n${helpText}`;
}

async function handleLogin({ userId, userName, acornOpsClient }) {
  if (!isAcornOpsChatAuthConfigured(acornOpsClient)) {
    return "AcornOps login is not configured. Set `ACORNOPS_API_BASE_URL` and `EXTERNAL_INTEGRATION_SERVICE_TOKEN`, then restart the bot.";
  }

  const identity = externalIdentityForUserId(userId);
  if (!identity) {
    return missingIdentityText();
  }

  const link = await acornOpsClient.createExternalIntegrationLink(linkIdentityForUser(identity, userName));
  return [
    "AcornOps account link:",
    link.linkUrl,
    "",
    `Mattermost user: ${identityLabel({ userId, userName })}`,
    "This link expires in 10 minutes.",
    "No AcornOps password should be typed into Mattermost."
  ].join("\n");
}

async function handleStatus({ userId, userName, acornOpsClient, commandContextStore }) {
  if (!isAcornOpsChatAuthConfigured(acornOpsClient)) {
    return "AcornOps status is not configured. Set `ACORNOPS_API_BASE_URL` and `EXTERNAL_INTEGRATION_SERVICE_TOKEN`, then restart the bot.";
  }

  const identity = externalIdentityForUserId(userId);
  if (!identity) {
    return missingIdentityText();
  }

  const result = await acornOpsClient.resolveExternalIntegrationLink(identity);
  const context = commandContextStore.get(identity.externalUserId);
  if (result.status === "linked") {
    const user = result.user ?? {};
    const linkedUser = [user.displayName, user.email, user.id].filter(Boolean).join(" / ");
    return [
      "AcornOps bot status:",
      `- Mattermost user: ${identityLabel({ userId, userName })}`,
      `- Backend authentication: linked to AcornOps${linkedUser ? ` as ${linkedUser}` : ""}`,
      `- Workspace: ${formatReference(context.currentWorkspace)}`,
      `- Target: ${formatReference(context.currentTarget ?? context.currentCluster ?? context.currentVm)}`,
      `- Chat: ${context.currentSession ? `${formatReference(context.currentSession)} (${context.chatActive ? "active" : "paused"})` : "none"}`
    ].join("\n");
  }

  if (result.status === "unlinked") {
    return [
      "AcornOps bot status:",
      `- Mattermost user: ${identityLabel({ userId, userName })}`,
      "- Backend authentication: not linked. Run `login` in a direct message to connect AcornOps.",
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
}) {
  const parsedArgs = parseListArgs(commandArgs, ["q"]);
  if (parsedArgs.error) {
    return parsedArgs.error;
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    userId,
    commandLabel: "workspaces"
  });
  if (auth.response) {
    return auth.response;
  }

  if (parsedArgs.reference) {
    return handleWorkspaceDetail({
      reference: parsedArgs.reference,
      userId,
      userName,
      identity: auth.identity,
      acornOpsClient,
      commandContextStore,
      selectCurrent: false
    });
  }

  try {
    const page = await acornOpsClient.listWorkspaces(auth.identity, parsedArgs.filters);
    commandContextStore.rememberWorkspaces(auth.identity.externalUserId, page.items ?? []);
    return formatWorkspacePage({
      page,
      context: commandContextStore.get(auth.identity.externalUserId),
      userId,
      userName
    });
  } catch (error) {
    return workspaceErrorText(error);
  }
}

async function handleTargets({
  commandArgs,
  userId,
  userName,
  channelType,
  acornOpsClient,
  commandContextStore,
}) {
  const parsedArgs = parseListArgs(commandArgs, ["q", "targetType"]);
  if (parsedArgs.error) {
    return parsedArgs.error;
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    userId,
    commandLabel: "targets"
  });
  if (auth.response) {
    return auth.response;
  }

  if (parsedArgs.reference) {
    return handleTargetDetail({
      reference: parsedArgs.reference,
      userId,
      userName,
      identity: auth.identity,
      acornOpsClient,
      commandContextStore,
      selectCurrent: false
    });
  }

  const context = commandContextStore.get(auth.identity.externalUserId);
  if (!context.currentWorkspace) {
    return "Choose a workspace first: send `workspaces`, then `workspace 1`.";
  }

  try {
    const page = await acornOpsClient.listTargets(
      auth.identity,
      context.currentWorkspace.id,
      parsedArgs.filters
    );
    commandContextStore.rememberTargets(auth.identity.externalUserId, page.items ?? []);
    return formatTargetPage({
      page,
      context: commandContextStore.get(auth.identity.externalUserId),
      userId,
      userName
    });
  } catch (error) {
    return dataErrorText(error, "targets");
  }
}

async function handleTarget({
  commandArgs,
  userId,
  userName,
  channelType,
  acornOpsClient,
  commandContextStore,
}) {
  if (commandArgs.length !== 1) {
    return "`target` requires exactly one target number or id.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    userId,
    commandLabel: "target"
  });
  if (auth.response) {
    return auth.response;
  }

  return handleTargetDetail({
    reference: commandArgs[0],
    userId,
    userName,
    identity: auth.identity,
    acornOpsClient,
    commandContextStore,
    selectCurrent: true
  });
}

async function handleTargetDetail({
  reference,
  userId,
  userName,
  identity,
  acornOpsClient,
  commandContextStore,
  selectCurrent
}) {
  const context = commandContextStore.get(identity.externalUserId);
  const workspace = context.currentWorkspace;
  if (!workspace) {
    return "Choose a workspace first: send `workspaces`, then `workspace 1`.";
  }

  const target = resolveTargetReference(reference, context);
  if (!target) {
    return "I do not have that target number yet. Send `targets` first, or use a target id.";
  }

  try {
    const detail = await acornOpsClient.getTarget(identity, workspace.id, target.id);
    if (selectCurrent) {
      commandContextStore.selectTarget(identity.externalUserId, detail);
    }
    return formatTargetDetail({
      target: detail,
      context: commandContextStore.get(identity.externalUserId),
      fallbackWorkspace: workspace,
      userId,
      userName,
      selectCurrent
    });
  } catch (error) {
    return dataErrorText(error, "target");
  }
}

async function handleWorkspace({
  commandArgs,
  userId,
  userName,
  channelType,
  acornOpsClient,
  commandContextStore,
}) {
  if (commandArgs.length > 1) {
    return "`workspace` accepts at most one workspace number or id.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    userId,
    commandLabel: "workspace"
  });
  if (auth.response) {
    return auth.response;
  }

  if (commandArgs.length === 0) {
    const currentWorkspace = commandContextStore.get(auth.identity.externalUserId).currentWorkspace;
    if (!currentWorkspace) {
      return "Choose a workspace first: send `workspaces`, then `workspace 1`.";
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
    return "I do not have that workspace number yet. Send `workspaces` first, or use a workspace id.";
  }

  try {
    const detail = await acornOpsClient.getWorkspace(identity, workspace.id);
    if (selectCurrent) {
      commandContextStore.selectWorkspace(identity.externalUserId, detail);
    }
    return formatWorkspaceDetail({
      workspace: detail,
      context: commandContextStore.get(identity.externalUserId),
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
  userName,
  channelType,
  acornOpsClient,
  commandContextStore,
}) {
  if (commandArgs.length > 1) {
    return "`clusters` accepts at most one cluster number or id.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    userId,
    commandLabel: "clusters"
  });
  if (auth.response) {
    return auth.response;
  }

  if (commandArgs.length === 1) {
    return handleClusterDetail({
      reference: commandArgs[0],
      userId,
      userName,
      identity: auth.identity,
      acornOpsClient,
      commandContextStore,
      selectCurrent: false
    });
  }

  const workspace = resolveWorkspaceForUser({
    reference: "",
    identity: auth.identity,
    commandContextStore
  });
  if (!workspace) {
    return "Choose a workspace first: send `workspaces`, then `workspace 1`.";
  }

  try {
    const page = await acornOpsClient.listKubernetesClusters(auth.identity, workspace.id);
    commandContextStore.rememberClusters(auth.identity.externalUserId, page.items ?? []);
    return formatClusterPage({
      page,
      context: commandContextStore.get(auth.identity.externalUserId)
    });
  } catch (error) {
    return dataErrorText(error, "clusters");
  }
}

async function handleCluster({
  commandArgs,
  userId,
  userName,
  channelType,
  acornOpsClient,
  commandContextStore,
}) {
  if (commandArgs.length !== 1) {
    return "`cluster` requires exactly one cluster number or id.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    userId,
    commandLabel: "cluster"
  });
  if (auth.response) {
    return auth.response;
  }

  return handleClusterDetail({
    reference: commandArgs[0],
    userId,
    userName,
    identity: auth.identity,
    acornOpsClient,
    commandContextStore,
    selectCurrent: true
  });
}

async function handleClusterDetail({
  reference,
  userId,
  userName,
  identity,
  acornOpsClient,
  commandContextStore,
  selectCurrent
}) {
  const context = commandContextStore.get(identity.externalUserId);
  const workspace = context.currentWorkspace;
  if (!workspace) {
    return "Choose a workspace first: send `workspaces`, then `workspace 1`.";
  }

  const cluster = resolveClusterReference(reference, context);
  if (!cluster) {
    return "I do not have that cluster number yet. Send `clusters` first, or use a cluster id.";
  }

  try {
    const detail = await acornOpsClient.getKubernetesCluster(identity, workspace.id, cluster.id);
    if (selectCurrent) {
      commandContextStore.selectCluster(identity.externalUserId, detail);
    }
    return formatClusterDetail({
      cluster: detail,
      context: commandContextStore.get(identity.externalUserId),
      fallbackWorkspace: workspace,
      userId,
      userName,
      selectCurrent
    });
  } catch (error) {
    return dataErrorText(error, "cluster");
  }
}

async function handleResources({
  commandArgs,
  userId,
  userName,
  channelType,
  acornOpsClient,
  commandContextStore,
}) {
  const parsedArgs = parseTargetFilterArgs(commandArgs, ["q", "kind", "family", "namespace", "health"]);
  if (parsedArgs.error) {
    return parsedArgs.error;
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    userId,
    commandLabel: "resources"
  });
  if (auth.response) {
    return auth.response;
  }

  const context = commandContextStore.get(auth.identity.externalUserId);
  const target = selectedTarget(context, parsedArgs.hint);
  if (target.response) {
    return target.response;
  }

  try {
    if (target.type === "cluster") {
      const page = await acornOpsClient.listKubernetesClusterResources(
        auth.identity,
        context.currentWorkspace.id,
        target.reference.id,
        parsedArgs.filters
      );
      return formatResourcePage({
        title: "AcornOps resources:",
        page,
        context,
        userId,
        userName
      });
    }

    const resources = await acornOpsClient.listVirtualMachineResources(
      auth.identity,
      context.currentWorkspace.id,
      target.reference.id
    );
    return formatResourcePage({
      title: "AcornOps resources:",
      page: normalizeListResponse(resources),
      context,
      userId,
      userName
    });
  } catch (error) {
    return dataErrorText(error, "resources");
  }
}

async function handleFindings({
  commandArgs,
  userId,
  userName,
  channelType,
  acornOpsClient,
  commandContextStore,
}) {
  const parsedArgs = parseTargetFilterArgs(commandArgs, ["q", "severity", "namespace"]);
  if (parsedArgs.error) {
    return parsedArgs.error;
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    userId,
    commandLabel: "findings"
  });
  if (auth.response) {
    return auth.response;
  }

  const context = commandContextStore.get(auth.identity.externalUserId);
  const target = selectedTarget(context, parsedArgs.hint);
  if (target.response) {
    return target.response;
  }

  try {
    if (target.type === "cluster") {
      const page = await acornOpsClient.listKubernetesClusterFindings(
        auth.identity,
        context.currentWorkspace.id,
        target.reference.id,
        parsedArgs.filters
      );
      return formatFindingPage({
        title: "AcornOps findings:",
        page,
        context,
        userId,
        userName
      });
    }

    const findings = await acornOpsClient.listVirtualMachineFindings(
      auth.identity,
      context.currentWorkspace.id,
      target.reference.id
    );
    return formatFindingPage({
      title: "AcornOps findings:",
      page: normalizeListResponse(findings),
      context,
      userId,
      userName
    });
  } catch (error) {
    return dataErrorText(error, "findings");
  }
}

async function handleInvestigations({
  commandArgs,
  userId,
  userName,
  channelType,
  acornOpsClient,
  commandContextStore,
}) {
  const parsedArgs = parseListArgs(commandArgs, ["q", "severity", "clusterId", "namespace"], {
    allowReference: false
  });
  if (parsedArgs.error) {
    return parsedArgs.error;
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    userId,
    commandLabel: "investigations"
  });
  if (auth.response) {
    return auth.response;
  }

  const context = commandContextStore.get(auth.identity.externalUserId);
  if (!context.currentWorkspace) {
    return "Choose a workspace first: send `workspaces`, then `workspace 1`.";
  }

  try {
    const page = await acornOpsClient.listWorkspaceInvestigations(
      auth.identity,
      context.currentWorkspace.id,
      parsedArgs.filters
    );
    return formatFindingPage({
      title: "AcornOps investigations:",
      page,
      context,
      userId,
      userName
    });
  } catch (error) {
    return dataErrorText(error, "investigations");
  }
}

async function handleVirtualMachines({
  commandArgs,
  userId,
  userName,
  channelType,
  acornOpsClient,
  commandContextStore,
}) {
  if (commandArgs.length > 1) {
    return "`vms` accepts at most one VM number or id.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    userId,
    commandLabel: "vms"
  });
  if (auth.response) {
    return auth.response;
  }

  const context = commandContextStore.get(auth.identity.externalUserId);
  if (!context.currentWorkspace) {
    return "Choose a workspace first: send `workspaces`, then `workspace 1`.";
  }

  if (commandArgs.length === 1) {
    return handleVirtualMachineDetail({
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
    const page = await acornOpsClient.listVirtualMachines(auth.identity, context.currentWorkspace.id);
    commandContextStore.rememberVirtualMachines(auth.identity.externalUserId, page.items ?? []);
    return formatVirtualMachinePage({
      page,
      context: commandContextStore.get(auth.identity.externalUserId),
      userId,
      userName
    });
  } catch (error) {
    return dataErrorText(error, "VMs");
  }
}

async function handleVirtualMachine({
  commandArgs,
  userId,
  userName,
  channelType,
  acornOpsClient,
  commandContextStore,
}) {
  if (commandArgs.length !== 1) {
    return "`vm` requires exactly one VM number or id.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    userId,
    commandLabel: "vm"
  });
  if (auth.response) {
    return auth.response;
  }

  return handleVirtualMachineDetail({
    reference: commandArgs[0],
    userId,
    userName,
    identity: auth.identity,
    acornOpsClient,
    commandContextStore,
    selectCurrent: true
  });
}

async function handleVirtualMachineDetail({
  reference,
  userId,
  userName,
  identity,
  acornOpsClient,
  commandContextStore,
  selectCurrent
}) {
  const context = commandContextStore.get(identity.externalUserId);
  const workspace = context.currentWorkspace;
  if (!workspace) {
    return "Choose a workspace first: send `workspaces`, then `workspace 1`.";
  }

  const vm = resolveVirtualMachineReference(reference, context);
  if (!vm) {
    return "I do not have that VM number yet. Send `vms` first, or use a VM id.";
  }

  try {
    const detail = await acornOpsClient.getVirtualMachine(identity, workspace.id, vm.id);
    if (selectCurrent) {
      commandContextStore.selectVirtualMachine(identity.externalUserId, detail);
    }
    return formatVirtualMachineDetail({
      vm: detail,
      context: commandContextStore.get(identity.externalUserId),
      fallbackWorkspace: workspace,
      userId,
      userName,
      selectCurrent
    });
  } catch (error) {
    return dataErrorText(error, "VM");
  }
}

async function handleSessions({
  commandArgs,
  userId,
  userName,
  channelType,
  acornOpsClient,
  commandContextStore,
}) {
  if (commandArgs.length > 0) {
    return "`sessions` does not accept arguments yet.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    userId,
    commandLabel: "sessions"
  });
  if (auth.response) {
    return auth.response;
  }

  const context = commandContextStore.get(auth.identity.externalUserId);
  const target = selectedTarget(context);
  if (target.response) {
    return target.response;
  }

  try {
    const page = target.type === "cluster"
      ? await acornOpsClient.listKubernetesClusterSessions(
        auth.identity,
        context.currentWorkspace.id,
        target.reference.id
      )
      : await acornOpsClient.listTargetSessions(
        auth.identity,
        context.currentWorkspace.id,
        target.reference.id
      );
    commandContextStore.rememberSessions(auth.identity.externalUserId, page.items ?? []);
    return formatSessionPage({
      page,
      context: commandContextStore.get(auth.identity.externalUserId),
      userId,
      userName
    });
  } catch (error) {
    return dataErrorText(error, "sessions");
  }
}

async function handleSession({
  commandArgs,
  userId,
  userName,
  channelType,
  acornOpsClient,
  commandContextStore,
}) {
  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    userId,
    commandLabel: "session"
  });
  if (auth.response) {
    return auth.response;
  }

  if (commandArgs.length === 1 && commandArgs[0] === "new") {
    return handleNewSession({
      userId,
      userName,
      identity: auth.identity,
      acornOpsClient,
      commandContextStore
    });
  }

  if (commandArgs.length !== 1) {
    return "`session` requires `new` or one session number or id.";
  }

  const context = commandContextStore.get(auth.identity.externalUserId);
  const session = resolveSessionReference(commandArgs[0], context);
  if (!session) {
    return "I do not have that session number yet. Send `sessions` first, or use a session id.";
  }

  try {
    const detail = await acornOpsClient.getSession(auth.identity, session.id);
    commandContextStore.selectSession(auth.identity.externalUserId, detail);
    return formatSessionDetail({
      session: detail,
      context: commandContextStore.get(auth.identity.externalUserId),
      userId,
      userName,
      selectCurrent: true
    });
  } catch (error) {
    return dataErrorText(error, "session");
  }
}

async function handleNewSession({
  userId,
  userName,
  identity,
  acornOpsClient,
  commandContextStore
}) {
  try {
    const { session } = await createSessionForSelectedTarget({
      identity,
      acornOpsClient,
      commandContextStore
    });
    return formatSessionDetail({
      session,
      context: commandContextStore.get(identity.externalUserId),
      userId,
      userName,
      selectCurrent: true,
      created: true
    });
  } catch (error) {
    if (error instanceof CommandResponseError) {
      return error.message;
    }
    return dataErrorText(error, "session");
  }
}

async function handleMessages({
  commandArgs,
  userId,
  userName,
  channelType,
  acornOpsClient,
  commandContextStore,
}) {
  if (commandArgs.length > 1) {
    return "`messages` accepts at most one session number or id.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    userId,
    commandLabel: "messages"
  });
  if (auth.response) {
    return auth.response;
  }

  const context = commandContextStore.get(auth.identity.externalUserId);
  const session = resolveSessionReference(commandArgs[0] ?? "", context);
  if (!session) {
    return "No current session is selected. Send `sessions`, then `session 1`, or use `session new`.";
  }

  try {
    const page = await acornOpsClient.listSessionMessages(auth.identity, session.id);
    return formatMessagePage({
      page,
      context,
      userId,
      userName
    });
  } catch (error) {
    return dataErrorText(error, "messages");
  }
}

async function handleChat({
  commandArgs,
  userId,
  userName,
  channelType,
  acornOpsClient,
  commandContextStore,
}) {
  const subcommand = commandArgs[0] ?? "";
  const identity = externalIdentityForUserId(userId);
  if (!identity) {
    return missingIdentityText();
  }

  if (!subcommand) {
    const context = commandContextStore.get(identity.externalUserId);
    return formatChatStatus({ context, userId, userName });
  }

  if (subcommand === "pause") {
    const context = commandContextStore.get(identity.externalUserId);
    if (!context.currentSession) {
      return "No chat session is selected. Use `chat new` after choosing a workspace and target.";
    }
    commandContextStore.pauseChat(identity.externalUserId);
    return [
      "Chat paused.",
      "You can run inspection commands now. Use `chat resume` to continue this chat."
    ].join("\n");
  }

  if (subcommand === "resume") {
    const context = commandContextStore.get(identity.externalUserId);
    if (!context.currentSession) {
      return "No paused chat is available. Use `chat new` after choosing a workspace and target.";
    }
    commandContextStore.resumeChat(identity.externalUserId);
    return [
      ...formatContextLines(commandContextStore.get(identity.externalUserId), { userId, userName }),
      "Chat resumed. Send a question, or use `chat pause` to leave chat mode."
    ].join("\n");
  }

  if (subcommand === "end") {
    commandContextStore.endChat(identity.externalUserId);
    return {
      message: "Chat ended. The AcornOps session remains available in the AcornOps UI.",
      effects: [
        {
          type: "abortActiveRun",
          externalUserId: identity.externalUserId
        }
      ]
    };
  }

  if (subcommand !== "new") {
    return "`chat` supports `new`, `pause`, `resume`, and `end`.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    userId,
    commandLabel: "chat"
  });
  if (auth.response) {
    return auth.response;
  }

  const title = commandArgs.slice(1).join(" ").trim();
  const previousContext = commandContextStore.get(auth.identity.externalUserId);
  if (previousContext.activeRun) {
    return activeRunResponseText();
  }

  try {
    const { session } = await createSessionForSelectedTarget({
      identity: auth.identity,
      acornOpsClient,
      commandContextStore,
      title
    });
    commandContextStore.startChat(auth.identity.externalUserId, session);
    const lines = [
      ...formatContextLines(commandContextStore.get(auth.identity.externalUserId), { userId, userName }),
      "Chat started in read-only mode.",
      "Send a question. Use `chat pause` before running bot commands like `status`, `resources`, or `findings`."
    ];
    if (previousContext.chatActive) {
      lines.push("Previous chat is no longer resumable from Mattermost; use the AcornOps UI if you need it.");
    }
    return lines.join("\n");
  } catch (error) {
    if (error instanceof CommandResponseError) {
      return error.message;
    }
    return dataErrorText(error, "chat session");
  }
}

async function handleChatQuestion({
  question,
  userId,
  userName,
  channelType,
  acornOpsClient,
  commandContextStore,
  sourceMessageId = ""
}) {
  if (!question) {
    return "Send a question, or use `chat pause` to leave chat mode.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    userId,
    commandLabel: "chat"
  });
  if (auth.response) {
    return auth.response;
  }

  let context = commandContextStore.get(auth.identity.externalUserId);
  if (context.activeRun) {
    return activeRunResponseText();
  }

  let session = context.currentSession;
  if (!session) {
    try {
      const created = await createSessionForSelectedTarget({
        identity: auth.identity,
        acornOpsClient,
        commandContextStore
      });
      session = created.session;
      commandContextStore.startChat(auth.identity.externalUserId, session);
      context = commandContextStore.get(auth.identity.externalUserId);
    } catch (error) {
      if (error instanceof CommandResponseError) {
        return `${error.message}\nStart with \`chat new\` after choosing a target.`;
      }
      return dataErrorText(error, "chat session");
    }
  }

  try {
    const clientMessageId = chatClientMessageId({
      sourceMessageId
    });
    const result = await acornOpsClient.postSessionMessage(auth.identity, session.id, {
      content: question,
      clientMessageId
    });
    const runId = result.run_id ?? result.runId ?? "";
    const messageId = result.message_id ?? result.messageId ?? "";
    if (runId) {
      commandContextStore.rememberLatestRun(auth.identity.externalUserId, {
        id: runId,
        sessionId: session.id,
        status: "accepted"
      });
    }
    const followed = await followRunForAnswer({
      acornOpsClient,
      identity: auth.identity,
      session,
      runId,
      messageId
    });
    if (runId && followed.status) {
      commandContextStore.rememberLatestRun(auth.identity.externalUserId, {
        id: runId,
        sessionId: session.id,
        status: followed.status
      });
    }
    if (followed.answer) {
      return followed.answer;
    }

    if (runId) {
      commandContextStore.rememberActiveRun?.(auth.identity.externalUserId, {
        id: runId,
        sessionId: session.id,
        status: followed.status || "streaming"
      });
      return {
        message: formatChatPendingResponse(followed.status),
        effects: [
          {
            type: "followRun",
            identity: auth.identity,
            sessionId: session.id,
            runId,
            messageId
          }
        ]
      };
    }

    return formatChatPendingResponse(followed.status);
  } catch (error) {
    return chatMessageErrorText(error);
  }
}

async function createSessionForSelectedTarget({ identity, acornOpsClient, commandContextStore, title = "" }) {
  const context = commandContextStore.get(identity.externalUserId);
  const target = selectedTarget(context);
  if (target.response) {
    throw new CommandResponseError(target.response);
  }

  const sessionTitle = title || `Investigate ${target.reference.name || target.reference.id}`;
  const session = target.source === "cluster"
    ? await acornOpsClient.createKubernetesClusterSession(
      identity,
      context.currentWorkspace.id,
      target.reference.id,
      { title: sessionTitle }
    )
    : await acornOpsClient.createTargetSession(
      identity,
      context.currentWorkspace.id,
      target.reference.id,
      { title: sessionTitle }
    );

  commandContextStore.selectSession(identity.externalUserId, session);
  return { session };
}

function activeChatModeRoute({
  action,
  commandArgs,
  normalizedText,
  userId,
  commandContextStore
}) {
  const identity = externalIdentityForUserId(userId);
  const context = identity ? commandContextStore.get(identity.externalUserId) : null;
  if (!context?.chatActive) {
    return { asQuestion: false };
  }

  if (action === "chat" && ["pause", "end", "resume", "new"].includes(commandArgs[0] ?? "")) {
    return { asQuestion: false };
  }

  return { asQuestion: Boolean(normalizedText.trim()) };
}

function missingIdentityText() {
  return [
    "AcornOps account linking is unavailable because Mattermost did not provide the required identity context.",
    "Required identity field: user id."
  ].join("\n");
}

function externalIdentityForUserId(userId) {
  if (!userId) {
    return null;
  }

  return {
    externalUserId: userId
  };
}

function linkIdentityForUser(identity, userName) {
  const externalDisplayName = String(userName ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!externalDisplayName) {
    return identity;
  }

  return {
    ...identity,
    externalDisplayName
  };
}

function requireExternalDataCommand({
  acornOpsClient,
  userId,
  commandLabel
}) {
  if (!isAcornOpsChatAuthConfigured(acornOpsClient)) {
    const verb = commandLabel === "workspaces" ? "are" : "is";
    return {
      response: `AcornOps ${commandLabel} ${verb} not configured. Set \`ACORNOPS_API_BASE_URL\` and \`EXTERNAL_INTEGRATION_SERVICE_TOKEN\`, then restart the bot.`
    };
  }

  const identity = externalIdentityForUserId(userId);
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

function selectedTarget(context, hint = "") {
  if (!context.currentWorkspace) {
    return {
      response: "Choose a workspace first: send `workspaces`, then `workspace 1`."
    };
  }

  if (hint && hint !== "cluster" && hint !== "vm") {
    return {
      response: "Target hint must be `cluster` or `vm`."
    };
  }

  if (hint === "cluster") {
    if (!context.currentCluster) {
      return {
        response: "No current cluster is selected. Send `clusters`, then `cluster 1`."
      };
    }
    return { type: "cluster", reference: context.currentCluster };
  }

  if (hint === "vm") {
    if (!context.currentVm) {
      return {
        response: "No current VM is selected. Send `vms`, then `vm 1`."
      };
    }
    return { type: "vm", reference: context.currentVm };
  }

  if (context.currentTarget) {
    const type = normalizeTargetType(context.currentTarget.type);
    if (type === "kubernetes") {
      return {
        type: "cluster",
        reference: context.currentTarget,
        source: context.currentTarget.source ?? "target"
      };
    }
    if (type === "virtual_machine") {
      return {
        type: "vm",
        reference: context.currentTarget,
        source: context.currentTarget.source ?? "target"
      };
    }
  }

  if (context.currentCluster) {
    return { type: "cluster", reference: context.currentCluster, source: "cluster" };
  }

  if (context.currentVm) {
    return { type: "vm", reference: context.currentVm, source: "vm" };
  }

  return {
    response: "Choose a target first: send `targets`, then `target 1`."
  };
}

function isAcornOpsChatAuthConfigured(acornOpsClient) {
  if (!acornOpsClient) {
    return false;
  }

  if (typeof acornOpsClient.canUseExternalIntegrationAuth !== "function") {
    return true;
  }

  return acornOpsClient.canUseExternalIntegrationAuth();
}
