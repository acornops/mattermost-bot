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
    mattermostChatServiceToken: ""
  });
});

test("readBotConfig uses the configured Mattermost bot username", () => {
  const config = readBotConfig({
    CSIT_MATTERMOST_BOT_USERNAME: "renamed-bot"
  });

  assert.equal(config.mattermostBotUsername, "renamed-bot");
});

test("readBotConfig prefers the external integration service token", () => {
  const config = readBotConfig({
    EXTERNAL_INTEGRATION_SERVICE_TOKEN: "external-token",
    MATTERMOST_CHAT_SERVICE_TOKEN: "legacy-token"
  });

  assert.equal(config.mattermostChatServiceToken, "external-token");
});
