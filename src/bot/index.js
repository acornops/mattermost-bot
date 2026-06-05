import { MattermostClient } from "./mattermost-client.js";
import { AcornOpsClient } from "./acornops-client.js";
import { createMemoryAuthStore } from "./auth-store.js";
import { createMattermostBotRunner } from "./runner.js";

const baseUrl = process.env.CSIT_MATTERMOST_URL || "http://localhost:8065";
const token = process.env.CSIT_MATTERMOST_TOKEN || "";
const botUsername = process.env.CSIT_MATTERMOST_BOT_USERNAME || "acorn-ops-bot";
const acornOpsUrl = process.env.CSIT_ACORNOPS_URL || "http://localhost:8081";
const acornOpsLoginReturnTo = process.env.CSIT_ACORNOPS_LOGIN_RETURN_TO || "/api/v1/me";
const acornOpsChatServiceToken = process.env.CSIT_ACORNOPS_CHAT_SERVICE_TOKEN || "";

if (typeof globalThis.WebSocket !== "function") {
  throw new Error("This bot runner requires a Node.js runtime with global WebSocket support.");
}

const client = new MattermostClient({ baseUrl, token });
const acornOpsClient = new AcornOpsClient({
  baseUrl: acornOpsUrl,
  chatServiceToken: acornOpsChatServiceToken
});
const runner = createMattermostBotRunner({
  client,
  acornOpsClient,
  authStore: createMemoryAuthStore(),
  websocketFactory: (url) => new WebSocket(url),
  botUsername,
  acornOpsLoginReturnTo
});

await runner.start();
