import { MattermostClient } from "./mattermost-client.js";
import { AcornOpsClient } from "./acornops-client.js";
import { createMattermostBotRunner } from "./runner.js";

const baseUrl = process.env.CSIT_MATTERMOST_URL || "http://localhost:8065";
const token = process.env.CSIT_MATTERMOST_TOKEN || "";
const botUsername = process.env.CSIT_MATTERMOST_BOT_USERNAME || "acorn-ops-bot";
const acornOpsUrl = process.env.ACORNOPS_API_BASE_URL || "http://localhost:8081";
const acornOpsChatServiceToken = process.env.MATTERMOST_CHAT_SERVICE_TOKEN || "";

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
  websocketFactory: (url) => new WebSocket(url),
  botUsername
});

await runner.start();
