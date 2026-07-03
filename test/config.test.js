import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ACORNOPS_API_BASE_URL,
  DEFAULT_MATTERMOST_BOT_USERNAME,
  DEFAULT_MATTERMOST_URL,
  readBotConfig
} from "../src/bot/config.js";

test("readBotConfig applies local development defaults", () => {
  assert.deepEqual(readBotConfig({}), {
    mattermostUrl: DEFAULT_MATTERMOST_URL,
    mattermostToken: "",
    mattermostBotUsername: DEFAULT_MATTERMOST_BOT_USERNAME,
    acornOpsUrl: DEFAULT_ACORNOPS_API_BASE_URL,
    externalIntegrationServiceToken: "",
    botDatabaseUrl: "",
    botHttpHost: "0.0.0.0",
    botHttpPort: 0,
    botPublicBaseUrl: "",
    mattermostActionSecret: "",
    acornOpsWebhookSecret: ""
  });
});

test("readBotConfig uses the configured Mattermost bot username", () => {
  const config = readBotConfig({
    MATTERMOST_BOT_USERNAME: "renamed-bot"
  });

  assert.equal(config.mattermostBotUsername, "renamed-bot");
});

test("readBotConfig reads Mattermost deployment configuration", () => {
  const config = readBotConfig({
    MATTERMOST_URL: "https://mattermost.example.com",
    MATTERMOST_BOT_TOKEN: "bot-token"
  });

  assert.equal(config.mattermostUrl, "https://mattermost.example.com");
  assert.equal(config.mattermostToken, "bot-token");
});

test("readBotConfig reads only the external integration service token", () => {
  const config = readBotConfig({
    EXTERNAL_INTEGRATION_SERVICE_TOKEN: "external-token",
    MATTERMOST_CHAT_SERVICE_TOKEN: "legacy-token"
  });

  assert.equal(config.externalIntegrationServiceToken, "external-token");
});

test("readBotConfig ignores the old Mattermost chat service token name", () => {
  const config = readBotConfig({
    MATTERMOST_CHAT_SERVICE_TOKEN: "legacy-token"
  });

  assert.equal(config.externalIntegrationServiceToken, "");
});

test("readBotConfig reads bot persistence and inbound HTTP configuration", () => {
  const config = readBotConfig({
    BOT_DATABASE_URL: "postgres://bot:secret@db/acornops_bot",
    BOT_HTTP_HOST: "127.0.0.1",
    BOT_HTTP_PORT: "8090",
    BOT_PUBLIC_BASE_URL: "https://bot.example.com",
    MATTERMOST_ACTION_SECRET: "mattermost-secret",
    ACORNOPS_WEBHOOK_SECRET: "webhook-secret"
  });

  assert.equal(config.botDatabaseUrl, "postgres://bot:secret@db/acornops_bot");
  assert.equal(config.botHttpHost, "127.0.0.1");
  assert.equal(config.botHttpPort, 8090);
  assert.equal(config.botPublicBaseUrl, "https://bot.example.com");
  assert.equal(config.mattermostActionSecret, "mattermost-secret");
  assert.equal(config.acornOpsWebhookSecret, "webhook-secret");
});
