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

test("handleBotMessage returns help by default", async () => {
  assert.match(await handleBotMessage({ text: "" }), /AcornOps bot commands:/);
});

test("handleBotMessage creates an AcornOps account link for direct /login", async () => {
  const response = await handleBotMessage({
    text: "/login",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {
      async createMattermostLink(input) {
        assert.deepEqual(input, mattermostIdentity());
        return {
          linkUrl: "https://console.acornops.dev/integrations/mattermost/link?token=mmlink_123",
          expiresAt: "2026-06-09T00:10:00.000Z"
        };
      }
    }
  });

  assert.match(response, /AcornOps account link:/);
  assert.match(response, /https:\/\/console\.acornops\.dev\/integrations\/mattermost\/link\?token=mmlink_123/);
  assert.match(response, /This link expires in 10 minutes\./);
  assert.match(response, /No AcornOps password should be typed into Mattermost\./);
});

test("handleBotMessage refuses login without complete Mattermost identity", async () => {
  const response = await handleBotMessage({
    text: "login",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    mattermostIdentity: {
      mattermostUserId: "mattermost-user-1"
    },
    acornOpsClient: {
      async createMattermostLink() {
        throw new Error("createMattermostLink should not be called");
      }
    }
  });

  assert.match(response, /required identity context/);
  assert.match(response, /server id, team id, and user id/);
});

test("handleBotMessage keeps login direct-message only", async () => {
  const response = await handleBotMessage({
    text: "@acorn-ops-bot login",
    userId: "user-1",
    userName: "alice",
    channelType: "O",
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {
      async createMattermostLink() {
        throw new Error("createMattermostLink should not be called");
      }
    }
  });

  assert.match(response, /direct message/);
});

test("handleBotMessage status reports linked AcornOps identity", async () => {
  const response = await handleBotMessage({
    text: "/status",
    userId: "mattermost-user-1",
    userName: "alice",
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {
      async resolveMattermostLink(input) {
        assert.deepEqual(input, mattermostIdentity());
        return {
          status: "linked",
          user: {
            id: "acorn-user-1",
            email: "alice@example.com",
            displayName: "Alice"
          },
          link: {
            linkedAt: "2026-06-09T00:00:00.000Z",
            lastAuthenticatedAt: "2026-06-09T00:00:00.000Z",
            expiresAt: "2026-07-09T00:00:00.000Z"
          }
        };
      }
    }
  });

  assert.match(response, /Backend authentication: linked to AcornOps as Alice \/ alice@example\.com \/ acorn-user-1/);
});

test("handleBotMessage status tells unlinked users to run login", async () => {
  const response = await handleBotMessage({
    text: "status",
    userId: "mattermost-user-1",
    userName: "alice",
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {
      async resolveMattermostLink(input) {
        assert.deepEqual(input, mattermostIdentity());
        return {
          status: "unlinked"
        };
      }
    }
  });

  assert.match(response, /Backend authentication: not linked/);
  assert.match(response, /Run `login`/);
});

function mattermostIdentity() {
  return {
    mattermostServerId: "mattermost-server-1",
    mattermostTeamId: "mattermost-team-1",
    mattermostUserId: "mattermost-user-1"
  };
}
