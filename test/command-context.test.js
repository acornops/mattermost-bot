import assert from "node:assert/strict";
import test from "node:test";
import {
  createInMemoryCommandContextStore,
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
