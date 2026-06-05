const helpText = [
  "AcornOps bot commands:",
  "- `help` shows this help.",
  "- `login` starts AcornOps browser login with OIDC.",
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
  authStore = null,
  acornOpsLoginReturnTo = "/api/v1/me"
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

    return handleLogin({ userId, userName, acornOpsClient, authStore, acornOpsLoginReturnTo });
  }

  if (action === "status") {
    await refreshPendingLoginSession({ userId, acornOpsClient, authStore });
    const session = authStore?.getSession?.(userId) ?? authStore?.get?.(userId);
    const pendingLogin = authStore?.getPendingLogin?.(userId);
    return [
      "AcornOps bot status:",
      `- Mattermost user: ${identityLabel({ userId, userName })}`,
      `- Backend authentication: ${authStatusText({ session, pendingLogin })}`,
      "- Cluster access: not loaded"
    ].join("\n");
  }

  if (action === "clusters") {
    return "Cluster listing placeholder. The backend cluster-management API is not connected yet.";
  }

  return `Unknown AcornOps bot command: ${action}\n\n${helpText}`;
}

async function handleLogin({ userId, userName, acornOpsClient, authStore, acornOpsLoginReturnTo }) {
  if (!acornOpsClient) {
    return "AcornOps login is not configured. Set `CSIT_ACORNOPS_URL` and restart the bot.";
  }

  let backendLogin = null;
  let backendLoginError = "";
  try {
    backendLogin = await startBackendChatLogin({
      userId,
      userName,
      acornOpsClient,
      acornOpsLoginReturnTo
    });
  } catch (error) {
    backendLoginError = error instanceof Error ? error.message : String(error);
  }
  const loginUrl = backendLogin?.loginUrl ?? acornOpsClient.oidcLoginUrl({ returnTo: acornOpsLoginReturnTo });
  const pendingLoginInput = {
    mattermostUserId: userId,
    mattermostUserName: userName,
    loginUrl,
    returnTo: acornOpsLoginReturnTo
  };
  if (backendLogin?.id) {
    pendingLoginInput.id = backendLogin.id;
  }
  if (backendLogin?.expiresAt) {
    pendingLoginInput.expiresAt = backendLogin.expiresAt;
  }
  const pendingLogin = authStore?.createPendingLogin?.(pendingLoginInput);

  return [
    backendLogin ? "AcornOps chat login link:" : "AcornOps browser login link:",
    loginUrl,
    "",
    `Mattermost user: ${identityLabel({ userId, userName })}`,
    "No AcornOps password should be typed into Mattermost.",
    ...(backendLoginError ? [`Backend chat login API unavailable: ${backendLoginError}`] : []),
    pendingLogin
      ? `Chat login state: pending until ${pendingLogin.expiresAt}.`
      : "Chat login state: pending storage is not configured.",
    backendLogin
      ? "After browser login completes, send `status` here and I will refresh the backend chat-login transaction."
      : "After browser login completes, AcornOps owns the browser session. Bot-side identity completion still needs an AcornOps chat-completion API."
  ].join("\n");
}

async function startBackendChatLogin({ userId, userName, acornOpsClient, acornOpsLoginReturnTo }) {
  if (!acornOpsClient?.canStartMattermostChatLogin?.()) {
    return null;
  }

  const response = await acornOpsClient.startMattermostChatLogin({
    mattermostUserId: userId,
    mattermostUserName: userName,
    returnTo: acornOpsLoginReturnTo
  });

  return {
    id: response.id,
    loginUrl: response.loginUrl,
    expiresAt: response.expiresAt
  };
}

async function refreshPendingLoginSession({ userId, acornOpsClient, authStore }) {
  const pendingLogin = authStore?.getPendingLogin?.(userId);
  if (!pendingLogin || !acornOpsClient?.canStartMattermostChatLogin?.()) {
    return null;
  }

  const status = await acornOpsClient.getMattermostChatLogin(pendingLogin.id);
  if (status.status !== "completed") {
    return null;
  }

  const session = chatLoginStatusToSession(status);
  if (!session) {
    return null;
  }

  if (typeof authStore.completePendingLogin === "function") {
    return authStore.completePendingLogin(userId, session);
  }

  authStore.setSession?.(userId, session);
  authStore.clearPendingLogin?.(userId);
  return session;
}

function chatLoginStatusToSession(status) {
  if (!status?.user) {
    return null;
  }

  const token = status.session?.token ?? status.chatSessionToken ?? "";
  return {
    source: "mattermost-chat-oidc",
    user: status.user,
    token,
    expiresAt: status.session?.expiresAt ?? status.expiresAt ?? null,
    linkedAt: new Date().toISOString()
  };
}

function authStatusText({ session, pendingLogin }) {
  if (session) {
    return `connected as ${session.user.displayName} (${session.user.id})`;
  }

  if (pendingLogin) {
    return `OIDC login pending until ${pendingLogin.expiresAt}`;
  }

  return "not connected";
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
