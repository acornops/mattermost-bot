import { MattermostClient } from "./mattermost-client.js";
import { AcornOpsClient } from "./acornops-client.js";
import { readBotConfig } from "./config.js";
import { loadLocalEnv } from "./env.js";
import { createMattermostBotRunner } from "./runner.js";

loadLocalEnv();

const config = readBotConfig();

if (typeof globalThis.WebSocket !== "function") {
  throw new Error("This bot runner requires a Node.js runtime with global WebSocket support.");
}

const client = new MattermostClient({
  baseUrl: config.mattermostUrl,
  token: config.mattermostToken
});
const acornOpsClient = new AcornOpsClient({
  baseUrl: config.acornOpsUrl,
  chatServiceToken: config.mattermostChatServiceToken
});
const runner = createMattermostBotRunner({
  client,
  acornOpsClient,
  websocketFactory: (url) => new WebSocket(url),
  botUsername: config.mattermostBotUsername
});

await runner.start();
