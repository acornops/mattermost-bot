import { MattermostClient } from "./mattermost-client.js";
import { AcornOpsClient } from "./acornops-client.js";
import { readBotConfig } from "./config.js";
import { loadLocalEnv } from "./env.js";
import { createMattermostBotRunner } from "./runner.js";
import { createBotHttpServer } from "./server.js";
import { createCommandContextStore } from "./state/postgres-store.js";
import { createRunFollowerRegistry } from "./chat/follower.js";

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
const runFollowerRegistry = createRunFollowerRegistry({
  acornOpsClient,
  commandContextStore,
  postFollowUp: async ({ channelId, message, rootId = "", attachments = undefined }) => {
    return await client.createPost({ channelId, message, rootId, attachments });
  },
  acornOpsConsoleUrl: config.acornOpsConsoleUrl,
  botPublicBaseUrl: config.botPublicBaseUrl,
  mattermostActionSecret: config.mattermostActionSecret
});
const runner = createMattermostBotRunner({
  client,
  acornOpsClient,
  websocketFactory: (url) => new WebSocket(url),
  botUsername: config.mattermostBotUsername,
  commandContextStore,
  runFollowerRegistry,
  acornOpsConsoleUrl: config.acornOpsConsoleUrl,
  botPublicBaseUrl: config.botPublicBaseUrl,
  mattermostActionSecret: config.mattermostActionSecret
});
const httpServer = createBotHttpServer({
  host: config.botHttpHost,
  port: config.botHttpPort,
  mattermostActionSecret: config.mattermostActionSecret,
  alertTimeZone: config.alertTimeZone,
  botPublicBaseUrl: config.botPublicBaseUrl,
  acornOpsConsoleUrl: config.acornOpsConsoleUrl,
  commandContextStore,
  mattermostClient: client,
  acornOpsClient,
  runFollowerRegistry
});

await runner.start();
await httpServer.start();
