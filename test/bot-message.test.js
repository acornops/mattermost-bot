import assert from "node:assert/strict";
import test from "node:test";
import {
  handleBotMessage,
  normalizeBotText,
  shouldRespondToPost
} from "../src/bot/message.js";

test("normalizeBotText removes leading bot mention", () => {
  assert.equal(normalizeBotText("@acorn-ops-bot status", "acorn-ops-bot"), "status");
  assert.equal(normalizeBotText("@acorn-ops-bot: clusters", "acorn-ops-bot"), "clusters");
  assert.equal(normalizeBotText("status", "acorn-ops-bot"), "status");
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
      message: "@acorn-ops-bot status"
    },
    botUserId: "bot",
    botUsername: "acorn-ops-bot",
    channelType: "O"
  }), true);
});

test("handleBotMessage returns identity-aware status placeholder", async () => {
  const response = await handleBotMessage({
    text: "@acorn-ops-bot status",
    userId: "user-1",
    userName: "alice"
  });

  assert.match(response, /AcornOps bot status:/);
  assert.match(response, /alice \(user-1\)/);
});

test("handleBotMessage returns help by default", async () => {
  assert.match(await handleBotMessage({ text: "" }), /AcornOps bot commands:/);
});

test("handleBotMessage logs in through AcornOps dev login for direct messages", async () => {
  const sessions = new Map();
  const response = await handleBotMessage({
    text: "login",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    authStore: {
      set: (userId, session) => sessions.set(userId, session)
    },
    acornOpsClient: {
      async devLogin(input) {
        assert.deepEqual(input, {
          email: "mattermost-mattermost-user-1@acorn-ops-bot.local",
          name: "alice"
        });
        return {
          mode: "dev",
          sessionCookie: "acornops_cp_session=session-1",
          user: {
            id: "acorn-user-1",
            email: input.email,
            displayName: "alice"
          }
        };
      }
    }
  });

  assert.match(response, /AcornOps login complete\./);
  assert.match(response, /AcornOps user: alice \(acorn-user-1\)/);
  assert.equal(sessions.get("mattermost-user-1").sessionCookie, "acornops_cp_session=session-1");
});

test("handleBotMessage keeps login direct-message only", async () => {
  const response = await handleBotMessage({
    text: "@acorn-ops-bot login",
    userId: "user-1",
    userName: "alice",
    channelType: "O",
    acornOpsClient: {
      async devLogin() {
        throw new Error("devLogin should not be called");
      }
    }
  });

  assert.match(response, /direct message/);
});

test("handleBotMessage status reports stored AcornOps session", async () => {
  const response = await handleBotMessage({
    text: "status",
    userId: "mattermost-user-1",
    userName: "alice",
    authStore: {
      get(userId) {
        assert.equal(userId, "mattermost-user-1");
        return {
          user: {
            id: "acorn-user-1",
            displayName: "alice"
          }
        };
      }
    }
  });

  assert.match(response, /Backend authentication: connected as alice \(acorn-user-1\)/);
});
