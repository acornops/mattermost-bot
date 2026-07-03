import { MattermostClient } from "./mattermost-client.js";
import { AcornOpsClient } from "./acornops-client.js";
import { readBotConfig } from "./config.js";
import { loadLocalEnv } from "./env.js";
import { createMattermostBotRunner } from "./runner.js";
import { createBotHttpServer } from "./server.js";
import { createCommandContextStore } from "./state/postgres-store.js";

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
  externalIntegrationToken: config.externalIntegrationServiceToken
});
const commandContextStore = await createCommandContextStore({
  databaseUrl: config.botDatabaseUrl
});
const runner = createMattermostBotRunner({
  client,
  acornOpsClient,
  websocketFactory: (url) => new WebSocket(url),
  botUsername: config.mattermostBotUsername,
  commandContextStore,
  botPublicBaseUrl: config.botPublicBaseUrl,
  mattermostActionSecret: config.mattermostActionSecret
});
const httpServer = createBotHttpServer({
  host: config.botHttpHost,
  port: config.botHttpPort,
  mattermostActionSecret: config.mattermostActionSecret,
  acornOpsWebhookSecret: config.acornOpsWebhookSecret,
  commandContextStore,
  mattermostClient: client
});

await runner.start();
await httpServer.start();
