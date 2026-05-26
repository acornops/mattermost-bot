const helpText = [
  "CSIT commands:",
  "- `/csit help` shows this help.",
  "- `/csit login` starts the backend authentication flow once the API exists.",
  "- `/csit status` shows the local chat identity and mocked auth state.",
  "- `/csit clusters` will list accessible clusters once the backend API exists."
].join("\n");

function firstWord(text) {
  return text.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
}

export function parseSlashCommand(params) {
  return {
    token: params.get("token") ?? "",
    teamId: params.get("team_id") ?? "",
    teamDomain: params.get("team_domain") ?? "",
    channelId: params.get("channel_id") ?? "",
    channelName: params.get("channel_name") ?? "",
    userId: params.get("user_id") ?? "",
    userName: params.get("user_name") ?? "",
    command: params.get("command") ?? "",
    text: params.get("text") ?? "",
    responseUrl: params.get("response_url") ?? "",
    triggerId: params.get("trigger_id") ?? ""
  };
}

export function validateSlashCommandToken(actualToken, expectedToken) {
  if (!expectedToken) {
    return {
      ok: false,
      status: 500,
      message: "CSIT_MATTERMOST_COMMAND_TOKEN is not configured."
    };
  }

  if (actualToken !== expectedToken) {
    return {
      ok: false,
      status: 401,
      message: "Invalid Mattermost slash command token."
    };
  }

  return { ok: true, status: 200, message: "OK" };
}

export function handleCsitCommand(command) {
  const action = firstWord(command.text) || "help";

  if (action === "help") {
    return ephemeral(helpText);
  }

  if (action === "login") {
    return ephemeral([
      "Login flow placeholder.",
      "The backend API contract is pending, so no external authentication request was sent yet.",
      `Mattermost user: ${identityLabel(command)}`
    ].join("\n"));
  }

  if (action === "status") {
    return ephemeral([
      "CSIT status:",
      `- Mattermost user: ${identityLabel(command)}`,
      "- Backend authentication: not connected",
      "- Cluster access: not loaded"
    ].join("\n"));
  }

  if (action === "clusters") {
    return ephemeral("Cluster listing placeholder. The backend cluster-management API is not connected yet.");
  }

  return ephemeral(`Unknown CSIT command: ${action}\n\n${helpText}`);
}

function ephemeral(text) {
  return {
    response_type: "ephemeral",
    text
  };
}

function identityLabel(command) {
  if (command.userName && command.userId) {
    return `${command.userName} (${command.userId})`;
  }

  return command.userName || command.userId || "unknown";
}
