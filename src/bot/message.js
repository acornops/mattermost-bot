import { DEFAULT_MATTERMOST_BOT_USERNAME } from "./config.js";
import {
  createNullCommandContextStore,
  resolveClusterReference,
  resolveSessionReference,
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

const helpText = [
  "AcornOps bot commands:",
  "- `help` shows this help.",
  "- `login` creates an AcornOps account-link URL.",
  "- `status` checks whether this external chat account is linked to AcornOps.",
  "- `workspaces` lists AcornOps workspaces available to your linked account.",
  "- `workspaces 1` shows details for a workspace.",
  "- `workspace` shows details for the current workspace.",
  "- `workspace 1` changes the current workspace.",
  "- `clusters` lists clusters in the current workspace.",
  "- `clusters 1` shows details for a cluster.",
  "- `cluster 1` changes the current cluster.",
  "- `resources` lists resources for the selected cluster or VM.",
  "- `findings` lists findings for the selected cluster or VM.",
  "- `investigations` lists investigations in the current workspace.",
  "- `vms` lists VMs in the current workspace.",
  "- `vm 1` changes the current VM.",
  "- `sessions` lists sessions for the selected cluster or VM.",
  "- `session new` creates a read-only troubleshooting session.",
  "- `session 1` changes the current session.",
  "- `messages` lists messages in the current session.",
  "- `ask <question>` sends a read-only assistant message."
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

  if (action.startsWith("/")) {
    return "Commands do not use `/`. Try the command again without the slash, for example `clusters`.";
  }

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
      userName,
      channelType,
      acornOpsClient,
      commandContextStore,
      mattermostIdentity
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
      mattermostIdentity
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
      mattermostIdentity
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
      mattermostIdentity
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
      mattermostIdentity
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
      mattermostIdentity
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
      mattermostIdentity
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
      mattermostIdentity
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
      mattermostIdentity
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
      mattermostIdentity
    });
  }

  if (action === "ask") {
    return handleAsk({
      commandArgs,
      rawText: normalizedText,
      userId,
      userName,
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

async function handleStatus({ userId, userName, acornOpsClient, mattermostIdentity }) {
  if (!isAcornOpsChatAuthConfigured(acornOpsClient)) {
    return "AcornOps status is not configured. Set `ACORNOPS_API_BASE_URL` and `EXTERNAL_INTEGRATION_SERVICE_TOKEN`, then restart the bot.";
  }

  const identity = normalizeMattermostIdentity({ mattermostIdentity, userId });
  if (!identity) {
    return missingIdentityText();
  }

  const result = await acornOpsClient.resolveExternalIntegrationLink(identity);
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
  mattermostIdentity
}) {
  if (commandArgs.length > 1) {
    return "`workspaces` accepts at most one workspace number or id.";
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
      context: commandContextStore.get(auth.identity.externalUserId),
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
    return "`workspace` accepts at most one workspace number or id.";
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
      return "No current workspace is selected. Send `workspaces`, then `workspace 1`.";
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
  mattermostIdentity
}) {
  if (commandArgs.length > 1) {
    return "`clusters` accepts at most one cluster number or id.";
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
    return "No current workspace is selected. Send `workspaces`, then `workspace 1`.";
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
  mattermostIdentity
}) {
  if (commandArgs.length !== 1) {
    return "`cluster` requires exactly one cluster number or id.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    mattermostIdentity,
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
    return "No current workspace is selected. Send `workspaces`, then `workspace 1`.";
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
  mattermostIdentity
}) {
  if (commandArgs.length > 1) {
    return "`resources` accepts at most one target hint: `cluster` or `vm`.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    mattermostIdentity,
    userId,
    commandLabel: "resources"
  });
  if (auth.response) {
    return auth.response;
  }

  const context = commandContextStore.get(auth.identity.externalUserId);
  const target = selectedTarget(context, commandArgs[0]);
  if (target.response) {
    return target.response;
  }

  try {
    if (target.type === "cluster") {
      const page = await acornOpsClient.listKubernetesClusterResources(
        auth.identity,
        context.currentWorkspace.id,
        target.reference.id
      );
      return formatResourcePage({
        title: "AcornOps cluster resources:",
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
      title: "AcornOps VM resources:",
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
  mattermostIdentity
}) {
  if (commandArgs.length > 1) {
    return "`findings` accepts at most one target hint: `cluster` or `vm`.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    mattermostIdentity,
    userId,
    commandLabel: "findings"
  });
  if (auth.response) {
    return auth.response;
  }

  const context = commandContextStore.get(auth.identity.externalUserId);
  const target = selectedTarget(context, commandArgs[0]);
  if (target.response) {
    return target.response;
  }

  try {
    if (target.type === "cluster") {
      const page = await acornOpsClient.listKubernetesClusterFindings(
        auth.identity,
        context.currentWorkspace.id,
        target.reference.id
      );
      return formatFindingPage({
        title: "AcornOps cluster findings:",
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
      title: "AcornOps VM findings:",
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
  mattermostIdentity
}) {
  if (commandArgs.length > 0) {
    return "`investigations` does not accept arguments yet.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    mattermostIdentity,
    userId,
    commandLabel: "investigations"
  });
  if (auth.response) {
    return auth.response;
  }

  const context = commandContextStore.get(auth.identity.externalUserId);
  if (!context.currentWorkspace) {
    return "No current workspace is selected. Send `workspaces`, then `workspace 1`.";
  }

  try {
    const page = await acornOpsClient.listWorkspaceInvestigations(auth.identity, context.currentWorkspace.id);
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
  mattermostIdentity
}) {
  if (commandArgs.length > 1) {
    return "`vms` accepts at most one VM number or id.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    mattermostIdentity,
    userId,
    commandLabel: "vms"
  });
  if (auth.response) {
    return auth.response;
  }

  const context = commandContextStore.get(auth.identity.externalUserId);
  if (!context.currentWorkspace) {
    return "No current workspace is selected. Send `workspaces`, then `workspace 1`.";
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
  mattermostIdentity
}) {
  if (commandArgs.length !== 1) {
    return "`vm` requires exactly one VM number or id.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    mattermostIdentity,
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
    return "No current workspace is selected. Send `workspaces`, then `workspace 1`.";
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
  mattermostIdentity
}) {
  if (commandArgs.length > 0) {
    return "`sessions` does not accept arguments yet.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    mattermostIdentity,
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
  mattermostIdentity
}) {
  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    mattermostIdentity,
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
  mattermostIdentity
}) {
  if (commandArgs.length > 1) {
    return "`messages` accepts at most one session number or id.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    mattermostIdentity,
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

async function handleAsk({
  commandArgs,
  rawText,
  userId,
  userName,
  channelType,
  acornOpsClient,
  commandContextStore,
  mattermostIdentity
}) {
  if (commandArgs.length === 0) {
    return "`ask` requires a question.";
  }

  const auth = requireExternalDataCommand({
    channelType,
    acornOpsClient,
    mattermostIdentity,
    userId,
    commandLabel: "ask"
  });
  if (auth.response) {
    return auth.response;
  }

  let context = commandContextStore.get(auth.identity.externalUserId);
  let session = context.currentSession;
  if (!session) {
    try {
      const created = await createSessionForSelectedTarget({
        identity: auth.identity,
        acornOpsClient,
        commandContextStore
      });
      session = created.session;
      context = commandContextStore.get(auth.identity.externalUserId);
    } catch (error) {
      if (error instanceof CommandResponseError) {
        return error.message;
      }
      return dataErrorText(error, "session");
    }
  }

  const question = rawText.replace(/^ask\s+/i, "").trim();
  try {
    const result = await acornOpsClient.postSessionMessage(auth.identity, session.id, {
      content: question,
      clientMessageId: `${auth.identity.externalUserId}:${hashText(question)}`
    });
    return [
      ...formatContextLines(context, { userId, userName }),
      "AcornOps assistant run:",
      `- Session: ${formatReference(session)}`,
      `- Message id: ${result.message_id ?? result.messageId ?? "unknown"}`,
      `- Run id: ${result.run_id ?? result.runId ?? "unknown"}`,
      "- Tool access: read_only"
    ].join("\n");
  } catch (error) {
    return dataErrorText(error, "assistant run");
  }
}

async function createSessionForSelectedTarget({ identity, acornOpsClient, commandContextStore }) {
  const context = commandContextStore.get(identity.externalUserId);
  const target = selectedTarget(context);
  if (target.response) {
    throw new CommandResponseError(target.response);
  }

  const title = `Investigate ${target.reference.name || target.reference.id}`;
  const session = target.type === "cluster"
    ? await acornOpsClient.createKubernetesClusterSession(
      identity,
      context.currentWorkspace.id,
      target.reference.id,
      { title }
    )
    : await acornOpsClient.createTargetSession(
      identity,
      context.currentWorkspace.id,
      target.reference.id,
      { title }
    );

  commandContextStore.selectSession(identity.externalUserId, session);
  return { session };
}

function formatWorkspacePage({ page, context, userId, userName }) {
  const items = Array.isArray(page?.items) ? page.items : [];
  if (items.length === 0) {
    return [
      ...formatContextLines(context, { userId, userName }),
      "AcornOps workspaces:",
      "- No workspaces are available for this linked account."
    ].join("\n");
  }

  const lines = [
    ...formatContextLines(context, { userId, userName }),
    "AcornOps workspaces:"
  ];

  for (const [index, workspace] of items.entries()) {
    lines.push(`${index + 1}. ${formatWorkspaceSummary(workspace)}`);
  }

  if (page.nextCursor) {
    lines.push(`Next page cursor: ${page.nextCursor}`);
  }

  lines.push("Use `workspaces 1` for details or `workspace 1` to set the current workspace.");

  return lines.join("\n");
}

function formatWorkspaceDetail({ workspace, context, userId, userName, selectCurrent, currentPrefix }) {
  const lines = [
    ...formatContextLines(context, { userId, userName }),
    currentPrefix ? "Current AcornOps workspace:" : "AcornOps workspace:",
    `- Name: ${workspace.name ?? workspace.displayName ?? workspace.slug ?? "Unnamed workspace"}`,
    `- ID: ${workspace.id ?? "unknown"}`
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
    lines.push("Current workspace updated. Use `clusters` to list clusters here.");
  } else if (!currentPrefix) {
    lines.push("Use `workspace 1` to make this the current workspace.");
  } else {
    lines.push("Use `clusters` to list clusters in this workspace.");
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

function formatClusterPage({ page, context, userId, userName }) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const lines = [
    ...formatContextLines(context, { userId, userName }),
    "AcornOps clusters:"
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

function formatClusterDetail({ cluster, context, fallbackWorkspace, userId, userName, selectCurrent }) {
  const displayContext = {
    ...context,
    currentWorkspace: context.currentWorkspace ?? fallbackWorkspace
  };
  const lines = [
    ...formatContextLines(displayContext, { userId, userName }),
    "AcornOps cluster:",
    `- Name: ${cluster.name ?? cluster.displayName ?? cluster.clusterName ?? "Unnamed cluster"}`,
    `- ID: ${cluster.id ?? cluster.clusterId ?? "unknown"}`
  ];

  for (const detail of [
    formatField("Status", cluster.status),
    formatField("Agent", cluster.agentState),
    formatField("Version", cluster.kubernetesVersion ?? cluster.version),
    formatField("Provider", cluster.provider),
    formatField("Region", cluster.region)
  ]) {
    if (detail) {
      lines.push(`- ${detail}`);
    }
  }

  const summary = cluster.summary;
  if (summary && typeof summary === "object") {
    lines.push(`- Summary: ${formatCounts(summary)}`);
  }

  if (selectCurrent) {
    lines.push("Current cluster updated. Current VM and session cleared.");
  } else {
    lines.push("Use `cluster 1` to make this the current cluster.");
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

function formatVirtualMachinePage({ page, context, userId, userName }) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const lines = [
    ...formatContextLines(context, { userId, userName }),
    "AcornOps VMs:"
  ];

  if (items.length === 0) {
    lines.push("- No VMs are available in this workspace.");
    return lines.join("\n");
  }

  for (const [index, vm] of items.entries()) {
    lines.push(`${index + 1}. ${formatVirtualMachineSummary(vm)}`);
  }

  if (page.nextCursor) {
    lines.push(`Next page cursor: ${page.nextCursor}`);
  }

  return lines.join("\n");
}

function formatVirtualMachineDetail({ vm, context, fallbackWorkspace, userId, userName, selectCurrent }) {
  const displayContext = {
    ...context,
    currentWorkspace: context.currentWorkspace ?? fallbackWorkspace
  };
  const lines = [
    ...formatContextLines(displayContext, { userId, userName }),
    "AcornOps VM:",
    `- Name: ${vm.name ?? vm.displayName ?? vm.hostname ?? "Unnamed VM"}`,
    `- ID: ${vm.id ?? vm.targetId ?? vm.vmId ?? "unknown"}`
  ];

  for (const detail of [
    formatField("Status", vm.status),
    formatField("Hostname", vm.hostname),
    formatField("OS", vm.osFamily),
    formatField("Service manager", vm.serviceManager)
  ]) {
    if (detail) {
      lines.push(`- ${detail}`);
    }
  }

  if (selectCurrent) {
    lines.push("Current VM updated. Current cluster and session cleared.");
  } else {
    lines.push("Use `vm 1` to make this the current VM.");
  }

  return lines.join("\n");
}

function formatResourcePage({ title, page, context, userId, userName }) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const lines = [
    ...formatContextLines(context, { userId, userName }),
    title
  ];

  if (items.length === 0) {
    lines.push("- No resources are available for the selected target.");
    return lines.join("\n");
  }

  for (const [index, resource] of items.entries()) {
    lines.push(`${index + 1}. ${formatResourceSummary(resource)}`);
  }

  if (page.nextCursor) {
    lines.push(`Next page cursor: ${page.nextCursor}`);
  }

  return lines.join("\n");
}

function formatFindingPage({ title, page, context, userId, userName }) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const lines = [
    ...formatContextLines(context, { userId, userName }),
    title
  ];

  if (items.length === 0) {
    lines.push("- No findings are available.");
    return lines.join("\n");
  }

  for (const [index, finding] of items.entries()) {
    lines.push(`${index + 1}. ${formatFindingSummary(finding)}`);
  }

  if (page.nextCursor) {
    lines.push(`Next page cursor: ${page.nextCursor}`);
  }

  return lines.join("\n");
}

function formatSessionPage({ page, context, userId, userName }) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const lines = [
    ...formatContextLines(context, { userId, userName }),
    "AcornOps sessions:"
  ];

  if (items.length === 0) {
    lines.push("- No sessions are available for the selected target.");
    return lines.join("\n");
  }

  for (const [index, session] of items.entries()) {
    lines.push(`${index + 1}. ${formatSessionSummary(session)}`);
  }

  if (page.nextCursor) {
    lines.push(`Next page cursor: ${page.nextCursor}`);
  }

  return lines.join("\n");
}

function formatSessionDetail({ session, context, userId, userName, selectCurrent, created = false }) {
  const lines = [
    ...formatContextLines(context, { userId, userName }),
    created ? "AcornOps session created:" : "AcornOps session:",
    `- Title: ${session.title ?? session.name ?? "Untitled session"}`,
    `- ID: ${session.id ?? session.sessionId ?? "unknown"}`
  ];

  for (const detail of [
    formatField("Status", session.status),
    formatField("Target type", session.targetType),
    formatField("Expires at", session.expiresAt)
  ]) {
    if (detail) {
      lines.push(`- ${detail}`);
    }
  }

  if (selectCurrent) {
    lines.push("Current session updated.");
  }

  return lines.join("\n");
}

function formatMessagePage({ page, context, userId, userName }) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const lines = [
    ...formatContextLines(context, { userId, userName }),
    "AcornOps session messages:"
  ];

  if (items.length === 0) {
    lines.push("- No messages are available in this session.");
    return lines.join("\n");
  }

  for (const [index, message] of items.entries()) {
    const role = message.role ?? message.kind ?? "message";
    const content = singleLine(message.content ?? "");
    lines.push(`${index + 1}. ${role}: ${content || "(empty)"}`);
  }

  if (page.nextCursor) {
    lines.push(`Next page cursor: ${page.nextCursor}`);
  }

  return lines.join("\n");
}

function formatVirtualMachineSummary(vm) {
  const name = vm.name ?? vm.displayName ?? vm.hostname ?? vm.id ?? vm.targetId ?? "Unnamed VM";
  const id = vm.id ?? vm.targetId ?? vm.vmId;
  const displayId = id && id !== name ? ` (${id})` : "";
  const details = [
    formatField("status", vm.status),
    formatField("hostname", vm.hostname),
    formatField("os", vm.osFamily)
  ].filter(Boolean);

  return details.length > 0 ? `${name}${displayId} - ${details.join(", ")}` : `${name}${displayId}`;
}

function formatResourceSummary(resource) {
  const name = resource.name ?? resource.resourceName ?? resource.itemId ?? resource.id ?? "Unnamed resource";
  const kind = resource.kind ?? resource.resourceKind ?? resource.objectKind;
  const namespace = resource.namespace ?? resource.scopeName;
  const details = [
    kind,
    namespace ? `namespace: ${namespace}` : "",
    formatField("status", resource.status),
    resource.needsAttention === true ? "needs attention" : ""
  ].filter(Boolean);

  return details.length > 0 ? `${name} - ${details.join(", ")}` : name;
}

function formatFindingSummary(finding) {
  const title = finding.title ?? finding.findingId ?? finding.id ?? "Finding";
  const target = [
    finding.clusterName,
    finding.namespace,
    finding.resourceKind ?? finding.objectKind,
    finding.resourceName ?? finding.objectName
  ].filter(Boolean).join("/");
  const details = [
    formatField("severity", finding.severity),
    target
  ].filter(Boolean);

  return details.length > 0 ? `${title} - ${details.join(", ")}` : title;
}

function formatSessionSummary(session) {
  const title = session.title ?? session.name ?? session.id ?? session.sessionId ?? "Untitled session";
  const id = session.id ?? session.sessionId;
  const displayId = id && id !== title ? ` (${id})` : "";
  const details = [
    formatField("status", session.status),
    formatField("target", session.targetType),
    formatField("updated", session.updatedAt)
  ].filter(Boolean);

  return details.length > 0 ? `${title}${displayId} - ${details.join(", ")}` : `${title}${displayId}`;
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

function clusterErrorText(error) {
  const status = httpStatusFromError(error);
  if (status === 401) {
    return [
      "AcornOps clusters could not be loaded because this external chat account is not linked or the bot credentials are invalid.",
      "Run `login` in a direct message, then try `clusters` again."
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

function dataErrorText(error, label) {
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
  mattermostIdentity,
  userId,
  commandLabel
}) {
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

function selectedTarget(context, hint = "") {
  if (!context.currentWorkspace) {
    return {
      response: "No current workspace is selected. Send `workspaces`, then `workspace 1`."
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

  if (context.currentCluster) {
    return { type: "cluster", reference: context.currentCluster };
  }

  if (context.currentVm) {
    return { type: "vm", reference: context.currentVm };
  }

  return {
    response: "No current cluster or VM is selected. Send `clusters`, then `cluster 1`, or send `vms`, then `vm 1`."
  };
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

function formatContextLines(context, { userId, userName } = {}) {
  const lines = [
    "Context:",
    `- Mattermost user: ${identityLabel({ userId, userName })}`,
    `- Workspace: ${formatReference(context?.currentWorkspace)}`
  ];

  if (context?.currentCluster) {
    lines.push(`- Cluster: ${formatReference(context.currentCluster)}`);
  } else if (context?.currentVm) {
    lines.push(`- VM: ${formatReference(context.currentVm)}`);
  } else {
    lines.push("- Target: none");
  }

  if (context?.currentSession) {
    lines.push(`- Session: ${formatReference(context.currentSession)}`);
  }

  return lines;
}

function formatReference(reference) {
  if (!reference) {
    return "none";
  }

  if (reference.name && reference.id) {
    return `${reference.name} (${reference.id})`;
  }

  return reference.name || reference.id || "unknown";
}

function normalizeListResponse(value) {
  if (Array.isArray(value)) {
    return { items: value };
  }

  if (Array.isArray(value?.items)) {
    return value;
  }

  return { items: [] };
}

function singleLine(value) {
  const text = String(value);
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}

function hashText(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function isAcornOpsChatAuthConfigured(acornOpsClient) {
  if (!acornOpsClient) {
    return false;
  }

  if (typeof acornOpsClient.canUseExternalIntegrationAuth === "function") {
    return acornOpsClient.canUseExternalIntegrationAuth();
  }

  if (typeof acornOpsClient.canUseMattermostChatAuth !== "function") {
    return true;
  }

  return acornOpsClient.canUseMattermostChatAuth();
}
