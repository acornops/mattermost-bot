import assert from "node:assert/strict";
import test from "node:test";
import { createInMemoryCommandContextStore } from "../src/bot/commands/context.js";
import {
  handleBotMessage,
  handleBotMessageResult,
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
      message: "!status"
    },
    botUserId: "bot",
    channelType: "D"
  }), false);
});

test("shouldRespondToPost accepts direct messages", () => {
  assert.equal(shouldRespondToPost({
    post: {
      user_id: "user-1",
      message: "!status"
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
  const response = await handleBotMessage({ text: "" });
  assert.match(response, /AcornOps commands:/);
  assert.match(response, /login.*workspaces.*workspace 1.*targets.*target 1.*chat new/s);
  assert.match(response, /More commands, filters, and examples: https:\/\/github\.com\/acornops\/mattermost-bot\/wiki\/Mattermost-Bot-Commands/);
  assert.doesNotMatch(response, /sessions/);
  assert.doesNotMatch(response, /ask <question>/);
});

test("handleBotMessage returns concise filter help", async () => {
  const response = await handleBotMessage({ text: "!help filters" });

  assert.match(response, /resources.*kind.*family.*namespace.*health/s);
  assert.match(response, /health=healthy\|attention/);
  assert.match(response, /severity=critical\|warning\|info/);
  assert.match(response, /targetType=kubernetes\|virtual_machine/);
});

test("handleBotMessage rejects slash-prefixed commands", async () => {
  const response = await handleBotMessage({
    text: "/status"
  });

  assert.match(response, /with `!`/);
});

test("handleBotMessage creates an AcornOps account link for direct login", async () => {
  const response = await handleBotMessage({
    text: "!login",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    acornOpsClient: {
      async createExternalIntegrationLink(input) {
        assert.deepEqual(input, linkIdentity());
        return {
          linkUrl: "https://console.acornops.dev/integrations/external/link?token=intlink_123",
          expiresAt: "2026-06-09T00:10:00.000Z"
        };
      }
    }
  });

  assert.match(response, /AcornOps account link:/);
  assert.match(response, /https:\/\/console\.acornops\.dev\/integrations\/external\/link\?token=intlink_123/);
  assert.match(response, /This link expires in 10 minutes\./);
  assert.match(response, /No AcornOps password should be typed into Mattermost\./);
});

test("handleBotMessage refuses login without complete Mattermost identity", async () => {
  const response = await handleBotMessage({
    text: "!login",
    userName: "alice",
    channelType: "D",
    acornOpsClient: {
      async createExternalIntegrationLink() {
        throw new Error("createExternalIntegrationLink should not be called");
      }
    }
  });

  assert.match(response, /required identity context/);
  assert.match(response, /user id/);
});

test("handleBotMessage reports login configuration when service token is missing", async () => {
  const response = await handleBotMessage({
    text: "!login",
    userId: "mattermost-user-1",
    channelType: "D",
    acornOpsClient: {
      canUseExternalIntegrationAuth() {
        return false;
      },
      async createExternalIntegrationLink() {
        throw new Error("createExternalIntegrationLink should not be called");
      }
    }
  });

  assert.match(response, /AcornOps login is not configured/);
  assert.match(response, /EXTERNAL_INTEGRATION_SERVICE_TOKEN/);
});

test("handleBotMessage keeps login direct-message only", async () => {
  const response = await handleBotMessage({
    text: "@acorn-ops-bot !login",
    userId: "user-1",
    userName: "alice",
    channelType: "O",
    acornOpsClient: {
      async createExternalIntegrationLink() {
        throw new Error("createExternalIntegrationLink should not be called");
      }
    }
  });

  assert.match(response, /direct message/);
});

test("handleBotMessage status reports linked AcornOps identity", async () => {
  const response = await handleBotMessage({
    text: "!status",
    userId: "mattermost-user-1",
    userName: "alice",
    acornOpsClient: {
      async resolveExternalIntegrationLink(input) {
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
    text: "!status",
    userId: "mattermost-user-1",
    userName: "alice",
    acornOpsClient: {
      async resolveExternalIntegrationLink(input) {
        return {
          status: "unlinked"
        };
      }
    }
  });

  assert.match(response, /Backend authentication: not linked/);
  assert.match(response, /Run `login`/);
});

test("handleBotMessage reports status configuration when service token is missing", async () => {
  const response = await handleBotMessage({
    text: "!status",
    userId: "mattermost-user-1",
    acornOpsClient: {
      canUseExternalIntegrationAuth() {
        return false;
      },
      async resolveExternalIntegrationLink() {
        throw new Error("resolveExternalIntegrationLink should not be called");
      }
    }
  });

  assert.match(response, /AcornOps status is not configured/);
  assert.match(response, /EXTERNAL_INTEGRATION_SERVICE_TOKEN/);
});

test("handleBotMessage lists workspaces for a linked direct-message user", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  const response = await handleBotMessage({
    text: "!workspaces",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    commandContextStore,
    acornOpsClient: {
      async listWorkspaces(input) {
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

test("handleBotMessage adds workspace selection actions when callback URL is configured", async () => {
  const result = await handleBotMessageResult({
    text: "!workspaces",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    botPublicBaseUrl: "https://bot.example.com/",
    mattermostActionSecret: "action-secret",
    acornOpsClient: {
      async listWorkspaces() {
        return {
          items: [
            {
              id: "workspace-1",
              name: "Platform"
            }
          ]
        };
      }
    }
  });

  assert.match(result.message, /AcornOps workspaces:/);
  assert.deepEqual(result.attachments, [
    {
      text: "Choose workspace",
      actions: [
        {
          name: "1",
          integration: {
            url: "https://bot.example.com/mattermost/actions",
            context: {
              action: "select_workspace",
              secret: "action-secret",
              externalUserId: "mattermost-user-1",
              workspace: {
                id: "workspace-1",
                name: "Platform"
              }
            }
          }
        }
      ]
    }
  ]);
});

test("handleBotMessage reports no available workspaces", async () => {
  const response = await handleBotMessage({
    text: "!workspaces",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    acornOpsClient: {
      async listWorkspaces(input) {
        return { items: [] };
      }
    }
  });

  assert.match(response, /No workspaces are available/);
});

test("handleBotMessage allows workspace commands from channel mentions", async () => {
  const response = await handleBotMessage({
    text: "@acorn-ops-bot !workspaces",
    userId: "user-1",
    userName: "alice",
    channelType: "O",
    acornOpsClient: {
      async listWorkspaces(input) {
        return { items: [] };
      }
    }
  });

  assert.match(response, /No workspaces are available/);
});

test("handleBotMessage treats bare workspace words as search", async () => {
  const response = await handleBotMessage({
    text: "!workspaces platform prod",
    userId: "mattermost-user-1",
    channelType: "D",
    acornOpsClient: {
      async listWorkspaces(input, filters) {
        assert.deepEqual(filters, { q: "platform prod" });
        return { items: [] };
      }
    }
  });

  assert.match(response, /No workspaces are available/);
});

test("handleBotMessage reports workspaces configuration when service token is missing", async () => {
  const response = await handleBotMessage({
    text: "!workspaces",
    userId: "mattermost-user-1",
    channelType: "D",
    acornOpsClient: {
      canUseExternalIntegrationAuth() {
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
    text: "!workspaces",
    userId: "mattermost-user-1",
    channelType: "D",
    acornOpsClient: {
      async listWorkspaces() {
        throw new Error("AcornOps API GET /api/v1/workspaces failed with 401: Unauthorized");
      }
    }
  });

  assert.match(response, /not linked or the bot credentials are invalid/);
  assert.match(response, /Run `login`/);
});

test("handleBotMessage reports backend workspace errors without leaking response body", async () => {
  const response = await handleBotMessage({
    text: "!workspaces",
    userId: "mattermost-user-1",
    channelType: "D",
    acornOpsClient: {
      async listWorkspaces() {
        throw new Error("AcornOps API GET /api/v1/workspaces failed with 500: database detail");
      }
    }
  });

  assert.match(response, /HTTP 500/);
  assert.doesNotMatch(response, /database detail/);
});

test("handleBotMessage shows workspace detail by remembered index without selecting current workspace", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.rememberWorkspaces("mattermost-user-1", [
    { id: "workspace-1", name: "Platform" }
  ]);

  const response = await handleBotMessage({
    text: "!workspaces 1",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    commandContextStore,
    acornOpsClient: {
      async getWorkspace(input, workspaceId) {
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
  assert.doesNotMatch(response, /Current workspace updated/);
  assert.match(response, /Use `workspace 1` to make this the current workspace/);
  assert.equal(commandContextStore.get("mattermost-user-1").currentWorkspace, null);
});

test("handleBotMessage selects current workspace with workspace index", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.rememberWorkspaces("mattermost-user-1", [
    { id: "workspace-1", name: "Platform" }
  ]);

  const response = await handleBotMessage({
    text: "!workspace 1",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    commandContextStore,
    acornOpsClient: {
      async getWorkspace(input, workspaceId) {
        assert.equal(workspaceId, "workspace-1");
        return {
          id: "workspace-1",
          name: "Platform",
          plan: { name: "Team" }
        };
      }
    }
  });

  assert.match(response, /Current workspace updated/);
  assert.deepEqual(commandContextStore.get("mattermost-user-1").currentWorkspace, {
    id: "workspace-1",
    name: "Platform"
  });
});

test("handleBotMessage shows details for current workspace", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.selectWorkspace("mattermost-user-1", {
    id: "workspace-1",
    name: "Platform"
  });

  const response = await handleBotMessage({
    text: "!workspace",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    acornOpsClient: {
      async getWorkspace(input, workspaceId) {
        assert.equal(workspaceId, "workspace-1");
        return {
          id: "workspace-1",
          name: "Platform",
          plan: { name: "Team" },
          quota: {
            kubernetesClusters: { used: 2, limit: 3 }
          }
        };
      }
    }
  });

  assert.match(response, /Current AcornOps workspace:/);
  assert.match(response, /Name: Platform/);
  assert.match(response, /Plan: Team/);
  assert.match(response, /Quota: clusters 2\/3/);
  assert.match(response, /Use `targets`/);
});

test("handleBotMessage lists and selects generic targets", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.selectWorkspace("mattermost-user-1", {
    id: "workspace-1",
    name: "Platform"
  });

  const listResponse = await handleBotMessage({
    text: "!targets q=prod targetType=kubernetes",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    acornOpsClient: {
      async listTargets(input, workspaceId, filters) {
        assert.equal(workspaceId, "workspace-1");
        assert.deepEqual(filters, {
          q: "prod",
          targetType: "kubernetes"
        });
        return {
          items: [
            {
              id: "target-1",
              name: "payments-prod",
              targetType: "kubernetes",
              status: "online"
            }
          ]
        };
      }
    }
  });

  assert.match(listResponse, /AcornOps targets:/);
  assert.match(listResponse, /1\. payments-prod \(target-1\) - Kubernetes, status: online/);

  const selectResponse = await handleBotMessage({
    text: "!target 1",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    acornOpsClient: {
      async getTarget(input, workspaceId, targetId) {
        assert.equal(workspaceId, "workspace-1");
        assert.equal(targetId, "target-1");
        return {
          id: "target-1",
          name: "payments-prod",
          targetType: "kubernetes",
          status: "online"
        };
      }
    }
  });

  assert.match(selectResponse, /Current target updated/);
  assert.deepEqual(commandContextStore.get("mattermost-user-1").currentTarget, {
    id: "target-1",
    name: "payments-prod",
    type: "kubernetes",
    source: "target"
  });
});

test("handleBotMessage creates chat sessions through generic target endpoint after target selection", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.selectWorkspace("mattermost-user-1", {
    id: "workspace-1",
    name: "Platform"
  });
  commandContextStore.selectTarget("mattermost-user-1", {
    id: "target-1",
    name: "payments-prod",
    targetType: "kubernetes"
  });

  const response = await handleBotMessage({
    text: "!chat new",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    acornOpsClient: {
      async createTargetSession(input, workspaceId, targetId, body) {
        assert.equal(workspaceId, "workspace-1");
        assert.equal(targetId, "target-1");
        assert.equal(body.title, "Investigate payments-prod");
        return {
          id: "session-1",
          title: "Investigate payments-prod"
        };
      },
      async createKubernetesClusterSession() {
        throw new Error("generic target selection should not use the cluster session endpoint");
      }
    }
  });

  assert.match(response, /New chat has been started/);
  assert.match(response, /Reply in the thread below/);
  assert.equal(commandContextStore.get("mattermost-user-1").chatActive, false);
});

test("handleBotMessage asks for a workspace before clusters", async () => {
  const response = await handleBotMessage({
    text: "!clusters",
    userId: "mattermost-user-1",
    channelType: "D",
    acornOpsClient: {
      async listKubernetesClusters() {
        throw new Error("listKubernetesClusters should not be called");
      }
    }
  });

  assert.match(response, /Choose a workspace first/);
});

test("handleBotMessage lists clusters in the current workspace", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.selectWorkspace("mattermost-user-1", {
    id: "workspace-1",
    name: "Platform"
  });

  const response = await handleBotMessage({
    text: "!clusters",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    acornOpsClient: {
      async listKubernetesClusters(input, workspaceId) {
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

  assert.match(response, /Workspace: Platform \(workspace-1\)/);
  assert.match(response, /AcornOps clusters:/);
  assert.match(response, /1\. Prod \(cluster-1\) - status: ready, agent: connected, version: v1\.33\.0/);
  assert.match(response, /Next page cursor: cluster-cursor-2/);
});

test("handleBotMessage shows cluster detail by remembered index without selecting it", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.selectWorkspace("mattermost-user-1", {
    id: "workspace-1",
    name: "Platform"
  });
  commandContextStore.rememberClusters("mattermost-user-1", [
    { id: "cluster-1", name: "Prod" }
  ]);
  const response = await handleBotMessage({
    text: "!clusters 1",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    acornOpsClient: {
      async getKubernetesCluster(input, workspaceId, clusterId) {
        assert.equal(workspaceId, "workspace-1");
        assert.equal(clusterId, "cluster-1");
        return {
          id: "cluster-1",
          name: "Prod",
          status: "online",
          summary: {
            resourceCount: 12,
            findingCount: 1
          }
        };
      }
    }
  });

  assert.match(response, /AcornOps cluster:/);
  assert.match(response, /Name: Prod/);
  assert.match(response, /Use `target 1` or `cluster 1`/);
  assert.equal(commandContextStore.get("mattermost-user-1").currentCluster, null);
});

test("handleBotMessage selects a cluster and clears VM and session context", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.selectWorkspace("mattermost-user-1", {
    id: "workspace-1",
    name: "Platform"
  });
  commandContextStore.rememberClusters("mattermost-user-1", [
    { id: "cluster-1", name: "Prod" }
  ]);
  commandContextStore.selectVirtualMachine("mattermost-user-1", {
    id: "vm-1",
    name: "App VM"
  });
  commandContextStore.selectSession("mattermost-user-1", {
    id: "session-1",
    title: "Old session"
  });

  const response = await handleBotMessage({
    text: "!cluster 1",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    acornOpsClient: {
      async getKubernetesCluster(input, workspaceId, clusterId) {
        assert.equal(workspaceId, "workspace-1");
        assert.equal(clusterId, "cluster-1");
        return {
          id: "cluster-1",
          name: "Prod",
          status: "online"
        };
      }
    }
  });

  const context = commandContextStore.get("mattermost-user-1");
  assert.match(response, /Current target updated/);
  assert.deepEqual(context.currentCluster, { id: "cluster-1", name: "Prod" });
  assert.equal(context.currentVm, null);
  assert.equal(context.currentSession, null);
});

test("handleBotMessage lists resources for the selected cluster", async () => {
  const commandContextStore = selectedClusterContext();
  const response = await handleBotMessage({
    text: "!resources",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "O",
    commandContextStore,
    acornOpsClient: {
      async listKubernetesClusterResources(input, workspaceId, clusterId) {
        assert.equal(workspaceId, "workspace-1");
        assert.equal(clusterId, "cluster-1");
        return {
          items: [
            {
              id: "resource-1",
              kind: "Pod",
              name: "payments-api",
              namespace: "payments",
              status: "Running"
            }
          ]
        };
      }
    }
  });

  assert.match(response, /Workspace: Platform \(workspace-1\)/);
  assert.match(response, /Target: Prod \(cluster-1\)/);
  assert.match(response, /AcornOps resources:/);
  assert.match(response, /payments-api - Pod, namespace: payments, status: Running/);
});

test("handleBotMessage lists findings for the selected VM", async () => {
  const commandContextStore = selectedVmContext();
  const response = await handleBotMessage({
    text: "!findings",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    acornOpsClient: {
      async listVirtualMachineFindings(input, workspaceId, vmId) {
        assert.equal(workspaceId, "workspace-1");
        assert.equal(vmId, "vm-1");
        return [
          {
            findingId: "finding-1",
            severity: "warning",
            title: "Service attention needed",
            objectKind: "systemd_service",
            objectName: "sshd"
          }
        ];
      }
    }
  });

  assert.match(response, /Target: App VM \(vm-1\)/);
  assert.match(response, /AcornOps findings:/);
  assert.match(response, /Service attention needed - severity: warning/);
});

test("handleBotMessage lists workspace investigations", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.selectWorkspace("mattermost-user-1", {
    id: "workspace-1",
    name: "Platform"
  });
  const response = await handleBotMessage({
    text: "!investigations",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    acornOpsClient: {
      async listWorkspaceInvestigations(input, workspaceId) {
        assert.equal(workspaceId, "workspace-1");
        return {
          items: [
            {
              id: "finding-1",
              severity: "critical",
              title: "Pod unhealthy",
              clusterName: "Prod",
              namespace: "payments"
            }
          ]
        };
      }
    }
  });

  assert.match(response, /AcornOps investigations:/);
  assert.match(response, /Pod unhealthy - severity: critical, Prod\/payments/);
});

test("handleBotMessage lists VMs and selects one", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.selectWorkspace("mattermost-user-1", {
    id: "workspace-1",
    name: "Platform"
  });

  const listResponse = await handleBotMessage({
    text: "!vms",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    acornOpsClient: {
      async listVirtualMachines(input, workspaceId) {
        assert.equal(workspaceId, "workspace-1");
        return {
          items: [
            {
              id: "vm-1",
              name: "App VM",
              status: "online",
              hostname: "app.internal"
            }
          ]
        };
      }
    }
  });

  assert.match(listResponse, /AcornOps VMs:/);
  assert.match(listResponse, /1\. App VM \(vm-1\)/);

  const selectResponse = await handleBotMessage({
    text: "!vm 1",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    acornOpsClient: {
      async getVirtualMachine(input, workspaceId, vmId) {
        assert.equal(workspaceId, "workspace-1");
        assert.equal(vmId, "vm-1");
        return {
          id: "vm-1",
          name: "App VM",
          status: "online"
        };
      }
    }
  });

  assert.match(selectResponse, /Current target updated/);
  assert.deepEqual(commandContextStore.get("mattermost-user-1").currentVm, {
    id: "vm-1",
    name: "App VM"
  });
  assert.equal(commandContextStore.get("mattermost-user-1").currentCluster, null);
});

test("handleBotMessage creates session and posts read-only assistant question", async () => {
  const commandContextStore = selectedClusterContext();
  const response = await handleBotMessage({
    text: "!ask why is the pod unhealthy?",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    acornOpsClient: {
      async createKubernetesClusterSession(input, workspaceId, clusterId, body) {
        assert.equal(workspaceId, "workspace-1");
        assert.equal(clusterId, "cluster-1");
        assert.match(body.title, /Prod/);
        return {
          id: "session-1",
          title: "Investigate Prod",
          status: "open",
          targetType: "kubernetes"
        };
      },
      async postSessionMessage(input, sessionId, body) {
        assert.equal(sessionId, "session-1");
        assert.equal(body.content, "why is the pod unhealthy?");
        assert.match(body.clientMessageId, /^mm-local-[A-Za-z0-9._~-]+$/);
        assert.doesNotMatch(body.clientMessageId, /:/);
        return {
          message_id: "message-1",
          run_id: "run-1"
        };
      },
      async getRun(input, runId) {
        assert.equal(runId, "run-1");
        return {
          id: "run-1",
          status: "completed",
          sessionId: "session-1"
        };
      },
      async listSessionMessages(input, sessionId) {
        assert.equal(sessionId, "session-1");
        return {
          items: [
            {
              role: "assistant",
              runId: "run-1",
              content: "The pod is failing its readiness probe."
            }
          ]
        };
      }
    }
  });

  assert.equal(response, "The pod is failing its readiness probe.");
  assert.deepEqual(commandContextStore.get("mattermost-user-1").currentSession, {
    id: "session-1",
    name: "Investigate Prod"
  });
  assert.equal(commandContextStore.get("mattermost-user-1").chatActive, true);
});

test("handleBotMessage starts chat mode with chat new", async () => {
  const commandContextStore = selectedClusterContext();
  const response = await handleBotMessage({
    text: "!chat new Investigate API health",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    commandContextStore,
    acornOpsClient: {
      async createKubernetesClusterSession(input, workspaceId, clusterId, body) {
        assert.equal(workspaceId, "workspace-1");
        assert.equal(clusterId, "cluster-1");
        assert.equal(body.title, "Investigate API health");
        return {
          id: "session-1",
          title: "Investigate API health",
          status: "open",
          targetType: "kubernetes"
        };
      }
    }
  });

  assert.match(response, /New chat has been started/);
  assert.match(response, /Reply in the thread below/);
  assert.equal(commandContextStore.get("mattermost-user-1").chatActive, false);
  assert.deepEqual(commandContextStore.get("mattermost-user-1").currentSession, {
    id: "session-1",
    name: "Investigate API health"
  });
});

test("handleBotMessage treats free text as a question while chat mode is active", async () => {
  const commandContextStore = selectedClusterContext();
  const threadChat = registerThreadChat(commandContextStore);

  const response = await handleBotMessage({
    text: "why is the pod unhealthy?",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    commandContextStore,
    threadChat,
    acornOpsClient: {
      async postSessionMessage(input, sessionId, body) {
        assert.equal(sessionId, "session-1");
        assert.equal(body.content, "why is the pod unhealthy?");
        assert.equal(body.toolAccessMode, undefined);
        assert.match(body.clientMessageId, /^mm-local-[A-Za-z0-9._~-]+$/);
        assert.doesNotMatch(body.clientMessageId, /:/);
        return {
          message_id: "message-1",
          run_id: "run-1"
        };
      },
      async getRun(input, runId) {
        assert.equal(runId, "run-1");
        return {
          id: "run-1",
          status: "completed",
          sessionId: "session-1"
        };
      },
      async listSessionMessages(input, sessionId) {
        assert.equal(sessionId, "session-1");
        return {
          items: [
            {
              role: "assistant",
              runId: "run-1",
              content: "The pod is failing its readiness probe."
            }
          ]
        };
      }
    }
  });

  assert.equal(response, "The pod is failing its readiness probe.");
  assert.doesNotMatch(response, /Run id/);
  assert.doesNotMatch(response, /Session:/);
  assert.deepEqual(commandContextStore.get("mattermost-user-1").latestRun, {
    id: "run-1",
    status: "completed",
    sessionId: "session-1"
  });
});

test("handleBotMessage polls chat run before falling back", async () => {
  const previousAttempts = process.env.CHAT_RUN_POLL_ATTEMPTS;
  const previousInterval = process.env.CHAT_RUN_POLL_INTERVAL_MS;
  process.env.CHAT_RUN_POLL_ATTEMPTS = "3";
  process.env.CHAT_RUN_POLL_INTERVAL_MS = "0";

  try {
    const commandContextStore = selectedClusterContext();
    const threadChat = registerThreadChat(commandContextStore);
    let getRunCalls = 0;

    const response = await handleBotMessage({
      text: "why is the pod unhealthy?",
      userId: "mattermost-user-1",
      userName: "alice",
      channelType: "D",
      commandContextStore,
      threadChat,
      acornOpsClient: {
        async postSessionMessage() {
          return {
            message_id: "message-1",
            run_id: "run-1"
          };
        },
        async getRun() {
          getRunCalls += 1;
          return {
            id: "run-1",
            status: getRunCalls < 2 ? "dispatching" : "completed",
            sessionId: "session-1"
          };
        },
        async listSessionMessages() {
          return {
            items: [
              {
                role: "assistant",
                runId: "run-1",
                content: "The deployment is waiting for one unavailable replica."
              }
            ]
          };
        }
      }
    });

    assert.equal(response, "The deployment is waiting for one unavailable replica.");
    assert.equal(getRunCalls, 2);
    assert.deepEqual(commandContextStore.get("mattermost-user-1").latestRun, {
      id: "run-1",
      status: "completed",
      sessionId: "session-1"
    });
  } finally {
    restoreEnvValue("CHAT_RUN_POLL_ATTEMPTS", previousAttempts);
    restoreEnvValue("CHAT_RUN_POLL_INTERVAL_MS", previousInterval);
  }
});

test("handleBotMessage hides run details while chat run is still active", async () => {
  const previousAttempts = process.env.CHAT_RUN_POLL_ATTEMPTS;
  const previousInterval = process.env.CHAT_RUN_POLL_INTERVAL_MS;
  process.env.CHAT_RUN_POLL_ATTEMPTS = "2";
  process.env.CHAT_RUN_POLL_INTERVAL_MS = "0";

  try {
    const commandContextStore = selectedClusterContext();
    const threadChat = registerThreadChat(commandContextStore);

    const response = await handleBotMessage({
      text: "why is the pod unhealthy?",
      userId: "mattermost-user-1",
      userName: "alice",
      channelType: "D",
      commandContextStore,
      threadChat,
      acornOpsClient: {
        async postSessionMessage() {
          return {
            message_id: "message-1",
            run_id: "run-1"
          };
        },
        async getRun() {
          return {
            id: "run-1",
            status: "dispatching",
            sessionId: "session-1"
          };
        }
      }
    });

    assert.match(response, /I'll post the answer here when it's ready/);
    assert.match(response, /Reply in this thread/);
    assert.doesNotMatch(response, /Run id/);
    assert.doesNotMatch(response, /Message id/);
    assert.doesNotMatch(response, /Session:/);
    assert.deepEqual(commandContextStore.get("mattermost-user-1").latestRun, {
      id: "run-1",
      status: "dispatching",
      sessionId: "session-1"
    });
  } finally {
    restoreEnvValue("CHAT_RUN_POLL_ATTEMPTS", previousAttempts);
    restoreEnvValue("CHAT_RUN_POLL_INTERVAL_MS", previousInterval);
  }
});

test("handleBotMessageResult returns follow-up metadata for streamed chat runs", async () => {
  const previousAttempts = process.env.CHAT_RUN_POLL_ATTEMPTS;
  const previousInterval = process.env.CHAT_RUN_POLL_INTERVAL_MS;
  process.env.CHAT_RUN_POLL_ATTEMPTS = "1";
  process.env.CHAT_RUN_POLL_INTERVAL_MS = "0";

  try {
    const commandContextStore = selectedClusterContext();
    const threadChat = registerThreadChat(commandContextStore);

    const result = await handleBotMessageResult({
      text: "why is the pod unhealthy?",
      userId: "mattermost-user-1",
      channelType: "D",
      sourceMessageId: "mattermost-post-1",
      commandContextStore,
      threadChat,
      acornOpsClient: {
        async postSessionMessage() {
          return {
            message_id: "message-1",
            run_id: "run-1"
          };
        },
        async getRun() {
          return {
            id: "run-1",
            status: "dispatching",
            sessionId: "session-1"
          };
        }
      }
    });

    assert.match(result.message, /I'll post the answer here when it's ready/);
    assert.deepEqual(result.effects, [
      {
        type: "followRun",
        identity: {
          externalUserId: "mattermost-user-1"
        },
        sessionId: "session-1",
        runId: "run-1",
        messageId: "message-1",
        channelId: "channel-1",
        rootId: "root-1"
      }
    ]);
    assert.deepEqual(commandContextStore.getChatThread("channel-1", "root-1").activeRun, {
      id: "run-1",
      status: "dispatching",
      sessionId: "session-1"
    });
  } finally {
    restoreEnvValue("CHAT_RUN_POLL_ATTEMPTS", previousAttempts);
    restoreEnvValue("CHAT_RUN_POLL_INTERVAL_MS", previousInterval);
  }
});

test("handleBotMessage blocks a second chat question while a streamed run is active", async () => {
  const commandContextStore = selectedClusterContext();
  const threadChat = registerThreadChat(commandContextStore);
  commandContextStore.rememberActiveRunForChat("channel-1", "root-1", {
    id: "run-1",
    sessionId: "session-1",
    status: "streaming"
  });

  const response = await handleBotMessage({
    text: "what about the deployment?",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    threadChat,
    acornOpsClient: {
      async postSessionMessage() {
        throw new Error("postSessionMessage should not be called");
      }
    }
  });

  assert.match(response, /AcornOps is still responding/);
});

test("handleBotMessage uses the Mattermost post id as the chat idempotency key", async () => {
  const previousAttempts = process.env.CHAT_RUN_POLL_ATTEMPTS;
  const previousInterval = process.env.CHAT_RUN_POLL_INTERVAL_MS;
  process.env.CHAT_RUN_POLL_ATTEMPTS = "1";
  process.env.CHAT_RUN_POLL_INTERVAL_MS = "0";

  try {
    const commandContextStore = selectedClusterContext();
    const threadChat = registerThreadChat(commandContextStore);
    const clientMessageIds = [];

    const acornOpsClient = {
      async postSessionMessage(_input, _sessionId, body) {
        clientMessageIds.push(body.clientMessageId);
        return {
          message_id: `message-${clientMessageIds.length}`,
          run_id: `run-${clientMessageIds.length}`
        };
      },
      async getRun() {
        return {
          status: "completed"
        };
      },
      async listSessionMessages(_input, _sessionId) {
        return {
          items: [
            {
              role: "assistant",
              runId: `run-${clientMessageIds.length}`,
              content: `answer-${clientMessageIds.length}`
            }
          ]
        };
      }
    };

    for (const sourceMessageId of ["mattermost-post-1", "mattermost-post-2", "mattermost-post-1"]) {
      await handleBotMessage({
        text: "why is the pod unhealthy?",
        userId: "mattermost-user-1",
        channelType: "D",
        sourceMessageId,
        commandContextStore,
        threadChat,
        acornOpsClient
      });
    }

    assert.equal(clientMessageIds[0], "mm-post-mattermost-post-1");
    assert.equal(clientMessageIds[1], "mm-post-mattermost-post-2");
    assert.notEqual(clientMessageIds[0], clientMessageIds[1]);
    assert.equal(clientMessageIds[0], clientMessageIds[2]);
  } finally {
    restoreEnvValue("CHAT_RUN_POLL_ATTEMPTS", previousAttempts);
    restoreEnvValue("CHAT_RUN_POLL_INTERVAL_MS", previousInterval);
  }
});

test("handleBotMessage correlates assistant replies to the accepted user message", async () => {
  const commandContextStore = selectedClusterContext();
  const threadChat = registerThreadChat(commandContextStore);

  const response = await handleBotMessage({
    text: "why is the pod unhealthy?",
    userId: "mattermost-user-1",
    channelType: "D",
    sourceMessageId: "mattermost-post-1",
    commandContextStore,
    threadChat,
    acornOpsClient: {
      async postSessionMessage() {
        return {
          message_id: "message-new",
          run_id: "run-new"
        };
      },
      async getRun() {
        return {
          id: "run-new",
          status: "completed",
          sessionId: "session-1",
          messageId: "message-new"
        };
      },
      async listSessionMessages() {
        return {
          items: [
            {
              role: "assistant",
              content: "Old answer without a run id."
            },
            {
              role: "assistant",
              runId: "run-new",
              content: "Fresh answer for the new message."
            }
          ]
        };
      }
    }
  });

  assert.equal(response, "Fresh answer for the new message.");
});

test("handleBotMessage reports AcornOps chat 400 reasons", async () => {
  const commandContextStore = selectedClusterContext();
  const threadChat = registerThreadChat(commandContextStore);

  const response = await handleBotMessage({
    text: "why is the pod unhealthy?",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    commandContextStore,
    threadChat,
    acornOpsClient: {
      async postSessionMessage() {
        throw new Error([
          "AcornOps API POST /api/v1/sessions/session-1/messages failed with 400:",
          JSON.stringify({
            error: {
              code: "AI_PROVIDER_NOT_CONFIGURED",
              message: "AI provider is not configured"
            }
          })
        ].join(" "));
      }
    }
  });

  assert.match(response, /AcornOps could not start the read-only chat run/);
  assert.match(response, /AI_PROVIDER_NOT_CONFIGURED: AI provider is not configured/);
  assert.doesNotMatch(response, /Try rephrasing/);
});

test("handleBotMessage retires user-level chat pause and resume", async () => {
  const commandContextStore = selectedClusterContext();

  const pauseResponse = await handleBotMessage({
    text: "!chat pause",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
  });
  assert.match(pauseResponse, /do not need pause/);

  const resumeResponse = await handleBotMessage({
    text: "!chat resume",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
  });
  assert.match(resumeResponse, /do not need resume/);

  const endResponse = await handleBotMessage({
    text: "!chat end",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
  });
  assert.match(endResponse, /inside the chat thread/);
});

test("handleBotMessageResult emits an abort effect for thread chat end", async () => {
  const commandContextStore = selectedClusterContext();
  const threadChat = registerThreadChat(commandContextStore);
  commandContextStore.rememberActiveRunForChat("channel-1", "root-1", {
    id: "run-1",
    sessionId: "session-1",
    status: "streaming"
  });

  const result = await handleBotMessageResult({
    text: "!chat end",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    threadChat
  });

  assert.match(result.message, /Chat thread closed/);
  assert.deepEqual(result.effects, [
    {
      type: "abortActiveRun",
      externalUserId: "mattermost-user-1",
      channelId: "channel-1",
      rootId: "root-1"
    }
  ]);
  assert.equal(commandContextStore.getChatThread("channel-1", "root-1").activeRun, null);
});

test("handleBotMessage treats plain status as assistant input inside a chat thread", async () => {
  const commandContextStore = selectedClusterContext();
  const threadChat = registerThreadChat(commandContextStore);

  const response = await handleBotMessage({
    text: "status",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    commandContextStore,
    threadChat,
    acornOpsClient: {
      async postSessionMessage(input, sessionId, body) {
        assert.equal(sessionId, "session-1");
        assert.equal(body.content, "status");
        return {
          message_id: "message-1",
          run_id: "run-1"
        };
      },
      async getRun() {
        return {
          id: "run-1",
          status: "completed",
          sessionId: "session-1"
        };
      },
      async listSessionMessages() {
        return {
          items: [
            {
              role: "assistant",
              runId: "run-1",
              content: "Your AcornOps chat session is active."
            }
          ]
        };
      },
      async resolveExternalIntegrationLink() {
        throw new Error("resolveExternalIntegrationLink should not be called inside a chat thread");
      }
    }
  });

  assert.equal(response, "Your AcornOps chat session is active.");
});

test("handleBotMessage treats plain resources as assistant input inside a chat thread", async () => {
  const commandContextStore = selectedClusterContext();
  const threadChat = registerThreadChat(commandContextStore);

  const response = await handleBotMessage({
    text: "resources kind=Pod",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    threadChat,
    acornOpsClient: {
      async postSessionMessage(input, sessionId, body) {
        assert.equal(sessionId, "session-1");
        assert.equal(body.content, "resources kind=Pod");
        return {
          message_id: "message-1",
          run_id: "run-1"
        };
      },
      async getRun() {
        return {
          id: "run-1",
          status: "completed",
          sessionId: "session-1"
        };
      },
      async listSessionMessages() {
        return {
          items: [
            {
              role: "assistant",
              runId: "run-1",
              content: "I can inspect the selected target resources from here."
            }
          ]
        };
      },
      async listKubernetesClusterResources() {
        throw new Error("listKubernetesClusterResources should not be called inside a chat thread");
      }
    }
  });

  assert.equal(response, "I can inspect the selected target resources from here.");
});

test("handleBotMessage runs main commands while a thread chat has an active run", async () => {
  const commandContextStore = selectedClusterContext();
  registerThreadChat(commandContextStore);
  commandContextStore.rememberActiveRunForChat("channel-1", "root-1", {
    id: "run-1",
    sessionId: "session-1",
    status: "streaming"
  });
  commandContextStore.pauseChat("mattermost-user-1");

  const response = await handleBotMessage({
    text: "!resources kind=Pod",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    acornOpsClient: {
      async postSessionMessage() {
        throw new Error("postSessionMessage should not be called while chat is paused");
      },
      async listKubernetesClusterResources(input, workspaceId, clusterId, filters) {
        assert.equal(workspaceId, "workspace-1");
        assert.equal(clusterId, "cluster-1");
        assert.deepEqual(filters, { kind: "Pod" });
        return {
          items: [
            {
              id: "resource-1",
              kind: "Pod",
              name: "payments-api",
              namespace: "payments"
            }
          ]
        };
      }
    }
  });

  assert.match(response, /AcornOps resources:/);
  assert.match(response, /payments-api/);
  assert.deepEqual(commandContextStore.getChatThread("channel-1", "root-1").activeRun, {
    id: "run-1",
    status: "streaming",
    sessionId: "session-1"
  });
});

test("handleBotMessage allows chat end inside a chat thread", async () => {
  const commandContextStore = selectedClusterContext();
  const threadChat = registerThreadChat(commandContextStore);

  const response = await handleBotMessage({
    text: "!chat end",
    userId: "mattermost-user-1",
    channelType: "D",
    commandContextStore,
    threadChat,
    acornOpsClient: {
      async postSessionMessage() {
        throw new Error("postSessionMessage should not be called for chat end");
      }
    }
  });

  assert.match(response, /Chat thread closed/);
  assert.equal(commandContextStore.getChatThread("channel-1", "root-1").status, "closed");
});

function selectedClusterContext() {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.selectWorkspace("mattermost-user-1", {
    id: "workspace-1",
    name: "Platform"
  });
  commandContextStore.selectCluster("mattermost-user-1", {
    id: "cluster-1",
    name: "Prod"
  });
  return commandContextStore;
}

function registerThreadChat(commandContextStore, options = {}) {
  return commandContextStore.registerChatThread("mattermost-user-1", {
    channelId: "channel-1",
    rootId: "root-1",
    sessionId: "session-1",
    sessionName: "Investigate Prod",
    title: "Investigate Prod",
    number: 1,
    status: "open",
    ...options
  });
}

function selectedVmContext() {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.selectWorkspace("mattermost-user-1", {
    id: "workspace-1",
    name: "Platform"
  });
  commandContextStore.selectVirtualMachine("mattermost-user-1", {
    id: "vm-1",
    name: "App VM"
  });
  return commandContextStore;
}
function externalIdentity() {
  return {
    externalUserId: "mattermost-user-1"
  };
}

function linkIdentity() {
  return {
    ...externalIdentity(),
    externalDisplayName: "alice"
  };
}

function restoreEnvValue(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
