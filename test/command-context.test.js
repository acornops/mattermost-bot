import assert from "node:assert/strict";
import test from "node:test";
import {
  createInMemoryCommandContextStore,
  resolveClusterReference,
  resolveSessionReference,
  resolveTargetReference,
  resolveVirtualMachineReference,
  resolveWorkflowReference,
  resolveWorkspaceReference
} from "../src/bot/commands/context.js";

test("command context remembers numbered workspaces per external user", () => {
  const store = createInMemoryCommandContextStore();

  store.rememberWorkspaces("user-1", [
    { id: "workspace-1", name: "Platform" },
    { id: "workspace-2", name: "Sandbox" }
  ]);
  store.rememberWorkspaces("user-2", [
    { id: "workspace-3", name: "Other" }
  ]);

  assert.deepEqual(resolveWorkspaceReference("1", store.get("user-1")), {
    id: "workspace-1",
    name: "Platform"
  });
  assert.deepEqual(resolveWorkspaceReference("2", store.get("user-1")), {
    id: "workspace-2",
    name: "Sandbox"
  });
  assert.deepEqual(resolveWorkspaceReference("1", store.get("user-2")), {
    id: "workspace-3",
    name: "Other"
  });
});

test("command context tracks current workspace", () => {
  const store = createInMemoryCommandContextStore();

  store.selectWorkspace("user-1", {
    id: "workspace-1",
    name: "Platform"
  });

  assert.deepEqual(resolveWorkspaceReference("", store.get("user-1")), {
    id: "workspace-1",
    name: "Platform"
  });
});

test("command context remembers workflows and clears them when workspace changes", () => {
  const store = createInMemoryCommandContextStore();
  store.selectWorkspace("user-1", { id: "workspace-1", name: "Platform" });
  store.rememberWorkflows("user-1", [
    { id: "workflow-1", name: "Cluster triage" }
  ]);

  assert.deepEqual(resolveWorkflowReference("1", store.get("user-1")), {
    id: "workflow-1",
    name: "Cluster triage"
  });
  store.selectWorkspace("user-1", { id: "workspace-2", name: "Sandbox" });
  assert.deepEqual(store.get("user-1").workflows, []);
});

test("workspace reference falls back to explicit id", () => {
  const store = createInMemoryCommandContextStore();

  assert.deepEqual(resolveWorkspaceReference("workspace-1", store.get("user-1")), {
    id: "workspace-1",
    name: ""
  });
});

test("command context tracks only one selected target", () => {
  const store = createInMemoryCommandContextStore();

  store.selectWorkspace("user-1", {
    id: "workspace-1",
    name: "Platform"
  });
  store.rememberClusters("user-1", [
    { id: "cluster-1", name: "Prod" }
  ]);
  store.selectCluster("user-1", {
    id: "cluster-1",
    name: "Prod"
  });

  assert.deepEqual(resolveClusterReference("", store.get("user-1")), {
    id: "cluster-1",
    name: "Prod"
  });

  store.selectVirtualMachine("user-1", {
    id: "vm-1",
    name: "App VM"
  });

  assert.equal(store.get("user-1").currentCluster, null);
  assert.deepEqual(resolveVirtualMachineReference("", store.get("user-1")), {
    id: "vm-1",
    name: "App VM"
  });
  assert.deepEqual(resolveTargetReference("", store.get("user-1")), {
    id: "vm-1",
    name: "App VM",
    type: "virtual_machine",
    source: "vm"
  });
});

test("workspace and target changes clear current session", () => {
  const store = createInMemoryCommandContextStore();

  store.selectWorkspace("user-1", { id: "workspace-1", name: "Platform" });
  store.selectCluster("user-1", { id: "cluster-1", name: "Prod" });
  store.selectSession("user-1", { id: "session-1", title: "Old session" });
  store.startChat("user-1", { id: "session-1", title: "Old session" });
  store.rememberLatestRun("user-1", { id: "run-1", status: "running", sessionId: "session-1" });

  assert.deepEqual(resolveSessionReference("", store.get("user-1")), {
    id: "session-1",
    name: "Old session"
  });
  assert.equal(store.get("user-1").chatActive, true);

  store.selectCluster("user-1", { id: "cluster-2", name: "Stage" });
  assert.equal(store.get("user-1").currentSession, null);
  assert.equal(store.get("user-1").chatActive, false);
  assert.equal(store.get("user-1").latestRun, null);

  store.selectSession("user-1", { id: "session-2", title: "New session" });
  store.selectWorkspace("user-1", { id: "workspace-2", name: "Sandbox" });
  assert.equal(store.get("user-1").currentCluster, null);
  assert.equal(store.get("user-1").currentVm, null);
  assert.equal(store.get("user-1").currentSession, null);
});

test("command context tracks active and paused chat sessions", () => {
  const store = createInMemoryCommandContextStore();

  store.startChat("user-1", { id: "session-1", title: "Investigate Prod" });
  assert.equal(store.get("user-1").chatActive, true);
  assert.deepEqual(store.get("user-1").currentSession, {
    id: "session-1",
    name: "Investigate Prod"
  });

  store.pauseChat("user-1");
  assert.equal(store.get("user-1").chatActive, false);
  assert.deepEqual(store.get("user-1").currentSession, {
    id: "session-1",
    name: "Investigate Prod"
  });

  store.resumeChat("user-1");
  assert.equal(store.get("user-1").chatActive, true);

  store.rememberLatestRun("user-1", { id: "run-1", status: "running", sessionId: "session-1" });
  store.rememberActiveRun("user-1", { id: "run-1", status: "streaming", sessionId: "session-1" });
  assert.deepEqual(store.get("user-1").latestRun, {
    id: "run-1",
    status: "running",
    sessionId: "session-1"
  });
  assert.deepEqual(store.get("user-1").activeRun, {
    id: "run-1",
    status: "streaming",
    sessionId: "session-1"
  });

  store.endChat("user-1");
  assert.equal(store.get("user-1").chatActive, false);
  assert.equal(store.get("user-1").currentSession, null);
  assert.equal(store.get("user-1").latestRun, null);
  assert.equal(store.get("user-1").activeRun, null);
});

test("command context tracks chat threads and per-thread active runs", () => {
  const store = createInMemoryCommandContextStore();

  assert.equal(store.nextChatNumber("user-1"), 1);
  assert.equal(store.nextChatNumber("user-1"), 2);
  const thread = store.registerChatThread("user-1", {
    channelId: "channel-1",
    rootId: "root-1",
    sessionId: "session-1",
    sessionName: "Investigate Prod",
    title: "Investigate Prod",
    number: 2
  });

  assert.deepEqual(thread, {
    externalUserId: "user-1",
    channelId: "channel-1",
    rootId: "root-1",
    sessionId: "session-1",
    sessionName: "Investigate Prod",
    title: "Investigate Prod",
    number: 2,
    status: "open",
    kind: "chat",
    workflowId: "",
    workspaceId: "",
    workflowInputs: {},
    activeRun: null
  });
  store.rememberActiveRunForChat("channel-1", "root-1", {
    id: "run-1",
    status: "streaming",
    sessionId: "session-1"
  });
  assert.equal(store.getChatThread("channel-1", "root-1").activeRun.id, "run-1");
  store.clearActiveRunForChat("channel-1", "root-1", "run-1");
  assert.equal(store.getChatThread("channel-1", "root-1").activeRun, null);
  store.closeChatThread("channel-1", "root-1", "user-1");
  assert.equal(store.getChatThread("channel-1", "root-1").status, "closed");
});

test("command context stores workflow thread launch context", () => {
  const store = createInMemoryCommandContextStore();
  store.registerChatThread("user-1", {
    channelId: "channel-1",
    rootId: "root-workflow-1",
    sessionId: "workflow-session-1",
    sessionName: "Cluster triage",
    title: "Cluster triage",
    kind: "workflow",
    workflowId: "cluster-triage",
    workspaceId: "workspace-1",
    workflowInputs: { clusterId: "cluster-1" }
  });

  const thread = store.getChatThread("channel-1", "root-workflow-1");
  assert.equal(thread.kind, "workflow");
  assert.equal(thread.workflowId, "cluster-triage");
  assert.deepEqual(thread.workflowInputs, { clusterId: "cluster-1" });
});

test("command context resets account-scoped selections and thread mappings", () => {
  const store = createInMemoryCommandContextStore();
  store.rememberAccountFingerprint("user-1", "fingerprint-1");
  store.selectWorkspace("user-1", { id: "workspace-1", name: "Platform" });
  store.selectTarget("user-1", {
    id: "target-1",
    name: "Prod",
    targetType: "kubernetes"
  });
  store.registerChatThread("user-1", {
    channelId: "channel-1",
    rootId: "root-1",
    sessionId: "session-1",
    sessionName: "Investigate Prod"
  });
  store.upsertWebhookRoute("user-1", {
    channelId: "channel-2",
    routeTokenHash: "token-hash",
    deliveryUrl: "https://bot.example.com/acornops/webhooks/routes/token"
  });

  const context = store.resetAccountContext("user-1");

  assert.equal(context.currentWorkspace, null);
  assert.equal(context.currentTarget, null);
  assert.equal(context.accountFingerprint, "fingerprint-1");
  assert.equal(context.contextGeneration, 1);
  assert.equal(store.getChatThread("channel-1", "root-1"), null);
  assert.equal(store.getWebhookRoute("user-1").channelId, "channel-2");
});

test("command context tracks user-level webhook routes and inbound event ids", () => {
  const store = createInMemoryCommandContextStore();

  const route = store.upsertWebhookRoute("user-1", {
    channelId: "channel-1",
    rootId: "root-1",
    displayName: "alice",
    routeTokenHash: "token-hash",
    deliveryUrl: "https://bot.example.com/acornops/webhooks/routes/token"
  });
  assert.equal(route.externalUserId, "user-1");
  assert.equal(route.provider, "acornops");
  assert.equal(route.connectionStatus, "pending");
  assert.equal(route.signingSecret, "");
  assert.deepEqual(route.subscriptions, []);
  const connectedRoute = store.connectWebhookRoute("user-1", {
    subscriptions: [
      {
        workspaceId: "workspace-1",
        workspaceName: "Platform",
        webhookId: "webhook-1",
        eventTypes: ["run.failed.v1"],
        signingSecret: "secret"
      }
    ]
  });
  assert.equal(connectedRoute.connectionStatus, "connected");
  assert.equal(connectedRoute.subscriptions[0].signingSecret, "secret");
  assert.equal(store.getWebhookRoute("user-1").channelId, "channel-1");
  assert.equal(store.getWebhookRouteByTokenHash("token-hash").externalUserId, "user-1");
  assert.equal(store.rememberInboundEvent("event-1"), true);
  assert.equal(store.rememberInboundEvent("event-1"), false);
  assert.equal(store.deleteWebhookRoute("user-1").channelId, "channel-1");
  assert.equal(store.getWebhookRoute("user-1"), null);
});
