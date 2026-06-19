import assert from "node:assert/strict";
import test from "node:test";
import {
  createInMemoryCommandContextStore,
  resolveClusterReference,
  resolveSessionReference,
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
});

test("workspace and target changes clear current session", () => {
  const store = createInMemoryCommandContextStore();

  store.selectWorkspace("user-1", { id: "workspace-1", name: "Platform" });
  store.selectCluster("user-1", { id: "cluster-1", name: "Prod" });
  store.selectSession("user-1", { id: "session-1", title: "Old session" });

  assert.deepEqual(resolveSessionReference("", store.get("user-1")), {
    id: "session-1",
    name: "Old session"
  });

  store.selectCluster("user-1", { id: "cluster-2", name: "Stage" });
  assert.equal(store.get("user-1").currentSession, null);

  store.selectSession("user-1", { id: "session-2", title: "New session" });
  store.selectWorkspace("user-1", { id: "workspace-2", name: "Sandbox" });
  assert.equal(store.get("user-1").currentCluster, null);
  assert.equal(store.get("user-1").currentVm, null);
  assert.equal(store.get("user-1").currentSession, null);
});
