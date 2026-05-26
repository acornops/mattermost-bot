import assert from "node:assert/strict";
import test from "node:test";
import {
  handleBotMessage,
  normalizeBotText,
  shouldRespondToPost
} from "../src/bot/message.js";

test("normalizeBotText removes leading bot mention", () => {
  assert.equal(normalizeBotText("@csit status", "csit"), "status");
  assert.equal(normalizeBotText("@csit: clusters", "csit"), "clusters");
  assert.equal(normalizeBotText("status", "csit"), "status");
});

test("shouldRespondToPost ignores bot-authored posts", () => {
  assert.equal(shouldRespondToPost({
    post: {
      user_id: "bot",
      message: "status"
    },
    botUserId: "bot",
    channelType: "D"
  }), false);
});

test("shouldRespondToPost accepts direct messages", () => {
  assert.equal(shouldRespondToPost({
    post: {
      user_id: "user-1",
      message: "status"
    },
    botUserId: "bot",
    channelType: "D"
  }), true);
});

test("shouldRespondToPost accepts mentions in channel posts", () => {
  assert.equal(shouldRespondToPost({
    post: {
      user_id: "user-1",
      message: "@csit status"
    },
    botUserId: "bot",
    botUsername: "csit",
    channelType: "O"
  }), true);
});

test("handleBotMessage returns identity-aware status placeholder", () => {
  const response = handleBotMessage({
    text: "@csit status",
    userId: "user-1",
    userName: "alice"
  });

  assert.match(response, /CSIT status:/);
  assert.match(response, /alice \(user-1\)/);
});

test("handleBotMessage returns help by default", () => {
  assert.match(handleBotMessage({ text: "" }), /CSIT commands:/);
});
