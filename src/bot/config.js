export const DEFAULT_MATTERMOST_URL = "http://localhost:8065";
export const DEFAULT_MATTERMOST_BOT_USERNAME = "acorn-ops-bot";
export const DEFAULT_ACORNOPS_API_BASE_URL = "http://localhost:8081";

export function readBotConfig(env = process.env) {
  return {
    mattermostUrl: env.MATTERMOST_URL || DEFAULT_MATTERMOST_URL,
    mattermostToken: env.MATTERMOST_BOT_TOKEN || "",
    mattermostBotUsername: env.MATTERMOST_BOT_USERNAME || DEFAULT_MATTERMOST_BOT_USERNAME,
    acornOpsUrl: env.ACORNOPS_API_BASE_URL || DEFAULT_ACORNOPS_API_BASE_URL,
    externalIntegrationServiceToken: env.EXTERNAL_INTEGRATION_SERVICE_TOKEN || ""
  };
}
