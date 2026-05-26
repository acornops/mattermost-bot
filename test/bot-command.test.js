import assert from "node:assert/strict";
import test from "node:test";
import {
  handleCsitCommand,
  parseSlashCommand,
  validateSlashCommandToken
} from "../src/bot/command.js";

test("parseSlashCommand maps Mattermost form fields", () => {
  const command = parseSlashCommand(new URLSearchParams({
    token: "secret",
    team_id: "team-1",
    channel_id: "channel-1",
    user_id: "user-1",
    user_name: "alice",
    command: "/csit",
    text: "status"
  }));

  assert.equal(command.token, "secret");
  assert.equal(command.userName, "alice");
  assert.equal(command.text, "status");
});

test("validateSlashCommandToken rejects missing server configuration", () => {
  const result = validateSlashCommandToken("from-mattermost", "");

  assert.equal(result.ok, false);
  assert.equal(result.status, 500);
});

test("validateSlashCommandToken rejects invalid tokens", () => {
  const result = validateSlashCommandToken("wrong", "expected");

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test("validateSlashCommandToken accepts matching tokens", () => {
  const result = validateSlashCommandToken("expected", "expected");

  assert.equal(result.ok, true);
});

test("handleCsitCommand returns ephemeral help by default", () => {
  const response = handleCsitCommand({
    text: "",
    userId: "user-1",
    userName: "alice"
  });

  assert.equal(response.response_type, "ephemeral");
  assert.match(response.text, /CSIT commands/);
});

test("handleCsitCommand returns identity-aware status placeholder", () => {
  const response = handleCsitCommand({
    text: "status",
    userId: "user-1",
    userName: "alice"
  });

  assert.equal(response.response_type, "ephemeral");
  assert.match(response.text, /alice \(user-1\)/);
  assert.match(response.text, /Backend authentication: not connected/);
});
