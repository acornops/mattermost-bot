import assert from "node:assert/strict";
import test from "node:test";
import { createInMemoryCommandContextStore } from "../src/bot/command-context.js";
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
  assert.match(await handleBotMessage({ text: "" }), /clusters/);
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
          linkUrl: "https://console.acornops.dev/integrations/external-chat/link?token=intlink_123",
          expiresAt: "2026-06-09T00:10:00.000Z"
        };
      }
    }
  });

  assert.match(response, /AcornOps account link:/);
  assert.match(response, /https:\/\/console\.acornops\.dev\/integrations\/external-chat\/link\?token=intlink_123/);
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
  assert.match(response, /EXTERNAL_INTEGRATION_SERVICE_TOKEN/);
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
  assert.match(response, /EXTERNAL_INTEGRATION_SERVICE_TOKEN/);
});

test("handleBotMessage lists workspaces for a linked direct-message user", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  const response = await handleBotMessage({
    text: "/workspaces",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    commandContextStore,
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
  assert.match(response, /1\. Platform \(workspace-1\) \| plan: Team \| quota: members 0\/10, clusters 0\/3, VMs 0\/5/);
  assert.match(response, /2\. Sandbox \(workspace-2\) \| plan: free/);
  assert.match(response, /Next page cursor: cursor-2/);
  assert.deepEqual(commandContextStore.get("mattermost-user-1").workspaces[0], {
    id: "workspace-1",
    name: "Platform"
  });
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
    text: "/workspaces 1 extra",
    userId: "mattermost-user-1",
    channelType: "D",
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {
      async listWorkspaces() {
        throw new Error("listWorkspaces should not be called");
      }
    }
  });

  assert.match(response, /at most one/);
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
  assert.match(response, /EXTERNAL_INTEGRATION_SERVICE_TOKEN/);
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

test("handleBotMessage shows workspace detail by remembered index and selects current workspace", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.rememberWorkspaces("mattermost-user-1", [
    { id: "workspace-1", name: "Platform" }
  ]);

  const response = await handleBotMessage({
    text: "workspaces 1",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    commandContextStore,
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {
      async getWorkspace(input, workspaceId) {
        assert.deepEqual(input, mattermostIdentity());
        assert.equal(workspaceId, "workspace-1");
        return {
          id: "workspace-1",
          name: "Platform",
          plan: { name: "Team" },
          permissions: {
            read_workspace_data: true,
            read_members: false
          },
          counts: {
            kubernetesClusters: 2
          },
          quota: {
            members: { used: 0, limit: 10 },
            kubernetesClusters: { used: 2, limit: 3 }
          }
        };
      }
    }
  });

  assert.match(response, /AcornOps workspace:/);
  assert.match(response, /Name: Platform/);
  assert.match(response, /Permissions: read_workspace_data/);
  assert.match(response, /Counts: kubernetesClusters 2/);
  assert.match(response, /Current workspace updated/);
  assert.deepEqual(commandContextStore.get("mattermost-user-1").currentWorkspace, {
    id: "workspace-1",
    name: "Platform"
  });
});

test("handleBotMessage reports current workspace", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.selectWorkspace("mattermost-user-1", {
    id: "workspace-1",
    name: "Platform"
  });

  const response = await handleBotMessage({
    text: "workspace",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {}
  });

  assert.match(response, /Current AcornOps workspace:/);
  assert.match(response, /Platform \(workspace-1\)/);
});

test("handleBotMessage asks for a workspace before clusters", async () => {
  const response = await handleBotMessage({
    text: "clusters",
    userId: "mattermost-user-1",
    channelType: "D",
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {
      async listKubernetesClusters() {
        throw new Error("listKubernetesClusters should not be called");
      }
    }
  });

  assert.match(response, /No current workspace is selected/);
});

test("handleBotMessage lists clusters in the current workspace", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.selectWorkspace("mattermost-user-1", {
    id: "workspace-1",
    name: "Platform"
  });

  const response = await handleBotMessage({
    text: "clusters",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {
      async listKubernetesClusters(input, workspaceId) {
        assert.deepEqual(input, mattermostIdentity());
        assert.equal(workspaceId, "workspace-1");
        return {
          items: [
            {
              id: "cluster-1",
              name: "Prod",
              status: "ready",
              agentState: "connected",
              kubernetesVersion: "v1.33.0"
            }
          ],
          nextCursor: "cluster-cursor-2"
        };
      }
    }
  });

  assert.match(response, /AcornOps clusters in Platform \(workspace-1\):/);
  assert.match(response, /1\. Prod \(cluster-1\) - status: ready, agent: connected, version: v1\.33\.0/);
  assert.match(response, /Next page cursor: cluster-cursor-2/);
});

test("handleBotMessage lists clusters for a remembered workspace index and selects it", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.rememberWorkspaces("mattermost-user-1", [
    { id: "workspace-1", name: "Platform" }
  ]);

  const response = await handleBotMessage({
    text: "clusters 1",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    mattermostIdentity: mattermostIdentity(),
    acornOpsClient: {
      async listKubernetesClusters(input, workspaceId) {
        assert.deepEqual(input, mattermostIdentity());
        assert.equal(workspaceId, "workspace-1");
        return { items: [] };
      }
    }
  });

  assert.match(response, /No clusters are available/);
  assert.deepEqual(commandContextStore.get("mattermost-user-1").currentWorkspace, {
    id: "workspace-1",
    name: "Platform"
  });
});

function mattermostIdentity() {
  return {
    externalUserId: "mattermost-user-1"
  };
}
