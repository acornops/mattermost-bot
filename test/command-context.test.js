import assert from "node:assert/strict";
import test from "node:test";
import {
  createInMemoryCommandContextStore,
  resolveClusterReference,
  resolveSessionReference,
  resolveTargetReference,
  resolveVirtualMachineReference,
  resolveWorkspaceReference
} from "../src/bot/command-context.js";

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
