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
  assert.match(await handleBotMessage({ text: "" }), /workspaces/);
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
    userName: "alice",
    channelType: "D",
    mattermostIdentity: {},
    acornOpsClient: {
      async createMattermostLink() {
        throw new Error("createMattermostLink should not be called");
      }
    }
  });

  assert.match(response, /required identity context/);
  assert.match(response, /user id/);
});

test("handleBotMessage reports login configuration when service token is missing", async () => {
  const response = await handleBotMessage({
    text: "login",
    userId: "mattermost-user-1",
    channelType: "D",
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {
      canUseMattermostChatAuth() {
        return false;
      },
      async createMattermostLink() {
        throw new Error("createMattermostLink should not be called");
      }
    }
  });

  assert.match(response, /AcornOps login is not configured/);
  assert.match(response, /MATTERMOST_CHAT_SERVICE_TOKEN/);
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
  assert.match(response, /Run `\/login`/);
});

test("handleBotMessage reports status configuration when service token is missing", async () => {
  const response = await handleBotMessage({
    text: "status",
    userId: "mattermost-user-1",
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {
      canUseMattermostChatAuth() {
        return false;
      },
      async resolveMattermostLink() {
        throw new Error("resolveMattermostLink should not be called");
      }
    }
  });

  assert.match(response, /AcornOps status is not configured/);
  assert.match(response, /MATTERMOST_CHAT_SERVICE_TOKEN/);
});

test("handleBotMessage lists workspaces for a linked direct-message user", async () => {
  const response = await handleBotMessage({
    text: "/workspaces",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {
      async listWorkspaces(input) {
        assert.deepEqual(input, mattermostIdentity());
        return {
          items: [
            {
              id: "workspace-1",
              name: "Platform",
              plan: {
                key: "team",
                name: "Team"
              },
              quota: {
                members: { used: 0, limit: 10 },
                kubernetesClusters: { used: 0, limit: 3 },
                virtualMachines: { used: 0, limit: 5 }
              }
            },
            {
              id: "workspace-2",
              name: "Sandbox",
              plan: {
                key: "free"
              }
            }
          ],
          nextCursor: "cursor-2"
        };
      }
    }
  });

  assert.match(response, /AcornOps workspaces:/);
  assert.match(response, /Mattermost user: alice \(mattermost-user-1\)/);
  assert.match(response, /Platform \(workspace-1\) \| plan: Team \| quota: members 0\/10, clusters 0\/3, VMs 0\/5/);
  assert.match(response, /Sandbox \(workspace-2\) \| plan: free/);
  assert.match(response, /Next page cursor: cursor-2/);
});

test("handleBotMessage reports no available workspaces", async () => {
  const response = await handleBotMessage({
    text: "workspaces",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {
      async listWorkspaces(input) {
        assert.deepEqual(input, mattermostIdentity());
        return { items: [] };
      }
    }
  });

  assert.match(response, /No workspaces are available/);
});

test("handleBotMessage keeps workspaces direct-message only", async () => {
  const response = await handleBotMessage({
    text: "@acorn-ops-bot workspaces",
    userId: "user-1",
    userName: "alice",
    channelType: "O",
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {
      async listWorkspaces() {
        throw new Error("listWorkspaces should not be called");
      }
    }
  });

  assert.match(response, /direct message/);
});

test("handleBotMessage requires bare workspaces command", async () => {
  const response = await handleBotMessage({
    text: "/workspaces extra",
    userId: "mattermost-user-1",
    channelType: "D",
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {
      async listWorkspaces() {
        throw new Error("listWorkspaces should not be called");
      }
    }
  });

  assert.match(response, /does not accept arguments/);
});

test("handleBotMessage reports workspaces configuration when service token is missing", async () => {
  const response = await handleBotMessage({
    text: "workspaces",
    userId: "mattermost-user-1",
    channelType: "D",
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {
      canUseMattermostChatAuth() {
        return false;
      },
      async listWorkspaces() {
        throw new Error("listWorkspaces should not be called");
      }
    }
  });

  assert.match(response, /AcornOps workspaces are not configured/);
  assert.match(response, /MATTERMOST_CHAT_SERVICE_TOKEN/);
});

test("handleBotMessage tells unlinked users to login before workspaces", async () => {
  const response = await handleBotMessage({
    text: "workspaces",
    userId: "mattermost-user-1",
    channelType: "D",
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {
      async listWorkspaces() {
        throw new Error("AcornOps API GET /api/v1/workspaces failed with 401: Unauthorized");
      }
    }
  });

  assert.match(response, /not linked or the bot credentials are invalid/);
  assert.match(response, /Run `\/login`/);
});

test("handleBotMessage reports backend workspace errors without leaking response body", async () => {
  const response = await handleBotMessage({
    text: "workspaces",
    userId: "mattermost-user-1",
    channelType: "D",
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {
      async listWorkspaces() {
        throw new Error("AcornOps API GET /api/v1/workspaces failed with 500: database detail");
      }
    }
  });

  assert.match(response, /HTTP 500/);
  assert.doesNotMatch(response, /database detail/);
});

function mattermostIdentity() {
  return {
    mattermostUserId: "mattermost-user-1"
  };
}
