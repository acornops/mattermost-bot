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
    externalIntegrationServiceToken: ""
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
