import { MattermostClient } from "./mattermost-client.js";
import { createMattermostBotRunner } from "./runner.js";

const baseUrl = process.env.CSIT_MATTERMOST_URL || "http://localhost:8065";
const token = process.env.CSIT_MATTERMOST_TOKEN || "";
const botUsername = process.env.CSIT_MATTERMOST_BOT_USERNAME || "csit";

if (typeof globalThis.WebSocket !== "function") {
  throw new Error("This bot runner requires a Node.js runtime with global WebSocket support.");
}

const client = new MattermostClient({ baseUrl, token });
const runner = createMattermostBotRunner({
  client,
  websocketFactory: (url) => new WebSocket(url),
  botUsername
});

await runner.start();
