import assert from "node:assert/strict";
import test from "node:test";
import { createInMemoryCommandContextStore } from "../src/bot/commands/context.js";
import { createRunFollowerRegistry } from "../src/bot/chat/follower.js";
import { verifyMattermostActionContext } from "../src/bot/mattermost-actions.js";

test("run follower posts the assistant answer on SSE completion", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  const posts = [];
  const registry = createRunFollowerRegistry({
    acornOpsClient: {
      async streamRun() {
        return asyncEvents([
          { event: "run_started", data: { status: "running" } },
          { event: "run_completed", data: { status: "completed" } }
        ]);
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
              content: "The pod is failing readiness checks."
            }
          ]
        };
      }
    },
    commandContextStore,
    postFollowUp: async (post) => {
      posts.push(post);
    },
    logger: quietLogger(),
    reconnectDelayMs: 0,
    fallbackPollIntervalMs: 0,
    fallbackPollMaxMs: 0
  });

  assert.equal(registry.start(followOptions()), true);
  await waitFor(() => posts.length === 1);

  assert.deepEqual(posts, [
    {
      channelId: "channel-1",
      message: "The pod is failing readiness checks.",
      rootId: ""
    }
  ]);
  assert.equal(commandContextStore.get("mattermost-user-1").activeRun, null);
  assert.deepEqual(commandContextStore.get("mattermost-user-1").latestRun, {
    id: "run-1",
    status: "completed",
    sessionId: "session-1"
  });
});

test("run follower posts concise failure and cancelled messages", async () => {
  const failurePosts = [];
  const cancelPosts = [];

  createRunFollowerRegistry({
    acornOpsClient: terminalStreamClient("run_failed"),
    commandContextStore: createInMemoryCommandContextStore(),
    postFollowUp: async (post) => {
      failurePosts.push(post);
    },
    logger: quietLogger(),
    reconnectDelayMs: 0,
    fallbackPollIntervalMs: 0,
    fallbackPollMaxMs: 0
  }).start(followOptions({ runId: "run-failed" }));

  createRunFollowerRegistry({
    acornOpsClient: terminalStreamClient("run_cancelled"),
    commandContextStore: createInMemoryCommandContextStore(),
    postFollowUp: async (post) => {
      cancelPosts.push(post);
    },
    logger: quietLogger(),
    reconnectDelayMs: 0,
    fallbackPollIntervalMs: 0,
    fallbackPollMaxMs: 0
  }).start(followOptions({ runId: "run-cancelled" }));

  await waitFor(() => failurePosts.length === 1 && cancelPosts.length === 1);

  assert.equal(failurePosts[0].message, "AcornOps could not complete that response.");
  assert.equal(cancelPosts[0].message, "AcornOps cancelled that response.");
});

test("run follower reads workflow output from the terminal run", async () => {
  const posts = [];
  let sessionMessageCalls = 0;
  const registry = createRunFollowerRegistry({
    acornOpsClient: {
      async streamRun() {
        return asyncEvents([{ event: "run_completed", data: {} }]);
      },
      async getRun() {
        return {
          id: "run-1",
          status: "completed",
          assistantMessage: {
            content: "Cluster triage completed."
          }
        };
      },
      async listSessionMessages() {
        sessionMessageCalls += 1;
        return { items: [] };
      }
    },
    commandContextStore: createInMemoryCommandContextStore(),
    postFollowUp: async (post) => {
      posts.push(post);
    },
    logger: quietLogger(),
    reconnectDelayMs: 0,
    fallbackPollIntervalMs: 0,
    fallbackPollMaxMs: 0
  });

  registry.start(followOptions({ kind: "workflow" }));
  await waitFor(() => posts.length === 1);

  assert.equal(posts[0].message, "Cluster triage completed.");
  assert.equal(sessionMessageCalls, 0);
});

test("run follower links approval requests and keeps streaming after approval", async () => {
  const posts = [];
  const registry = createRunFollowerRegistry({
    acornOpsClient: {
      async streamRun() {
        return asyncEvents([
          {
            event: "tool_approval_requested",
            data: { payload: { approval_id: "approval-1", tool: "restart_workload", summary: "Restart payments-api" } }
          },
          { event: "tool_approval_approved", data: { payload: { approval_id: "approval-1" } } },
          { event: "run_completed", data: { status: "completed" } }
        ]);
      },
      async getRun() {
        return { id: "run-1", status: "completed", sessionId: "session-1" };
      },
      async listSessionMessages() {
        return { items: [{ role: "assistant", runId: "run-1", content: "Restart completed." }] };
      }
    },
    commandContextStore: createInMemoryCommandContextStore(),
    acornOpsConsoleUrl: "https://console.acornops.dev/",
    postFollowUp: async (post) => posts.push(post),
    logger: quietLogger(),
    reconnectDelayMs: 0,
    fallbackPollIntervalMs: 0,
    fallbackPollMaxMs: 0
  });

  registry.start({ ...followOptions(), workspaceId: "workspace-1", rootId: "root-1" });
  await waitFor(() => posts.length === 3);

  assert.match(posts[0].message, /Approval required/);
  assert.match(posts[0].message, /https:\/\/console\.acornops\.dev\/workspaces\/workspace-1\/approvals\?runId=run-1&approvalId=approval-1/);
  assert.match(posts[1].message, /Approval approved/);
  assert.equal(posts[2].message, "Restart completed.");
});

test("workflow follower replays every step, deduplicates approvals, and uses the final attempt", async () => {
  const posts = [];
  const streamCursors = [];
  let streamCalls = 0;
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.registerChatThread("mattermost-user-1", {
    channelId: "channel-1",
    rootId: "root-1",
    sessionId: "session-1",
    kind: "workflow"
  });
  const registry = createRunFollowerRegistry({
    acornOpsClient: {
      async streamWorkflowExecution(identity, executionId, options) {
        assert.deepEqual(identity, { externalUserId: "mattermost-user-1" });
        assert.equal(executionId, "execution-1");
        streamCursors.push(options.after);
        streamCalls += 1;
        if (streamCalls === 1) {
          return asyncEvents([
            workflowEvent(1, "run_created", { runId: "run-1" }),
            workflowEvent(2, "approval_requested", {
              runId: "run-1",
              approvalId: "approval-1",
              payload: {
                toolName: "restart_workload",
                summary: "Restart payments-api",
                expiresAt: "2099-07-18T10:00:00.000Z"
              }
            })
          ]);
        }
        return asyncEvents([
          workflowEvent(2, "approval_requested", {
            runId: "run-1",
            approvalId: "approval-1",
            payload: { toolName: "restart_workload" }
          }),
          workflowEvent(3, "run_created", { runId: "run-2" }),
          workflowEvent(4, "run_event", {
            runId: "run-2",
            payload: {
              runEvent: {
                type: "tool_approval_requested",
                payload: {
                  approval_id: "approval-2",
                  tool: "cordon_node",
                  summary: "Cordon node-2"
                }
              }
            }
          }),
          workflowEvent(5, "approval_decided", {
            runId: "run-1",
            approvalId: "approval-1",
            payload: { status: "approved" }
          }),
          workflowEvent(6, "execution_status_changed", {
            runId: "run-2",
            payload: { status: "completed" }
          })
        ]);
      },
      async getWorkflowExecution() {
        return {
          execution: {
            id: "execution-1",
            status: streamCalls < 2 ? "running" : "completed"
          },
          attempts: [
            { id: "run-1", stepIndex: 0, attemptNumber: 1 },
            { id: "run-2", stepIndex: 1, attemptNumber: 1 }
          ]
        };
      },
      async getRun(identity, runId) {
        assert.equal(runId, "run-2");
        return {
          id: "run-2",
          status: "completed",
          assistantMessage: { content: "All workflow steps completed." }
        };
      }
    },
    commandContextStore,
    botPublicBaseUrl: "https://bot.example.com/",
    mattermostActionSecret: "action-secret",
    postFollowUp: async (post) => posts.push(post),
    logger: quietLogger(),
    reconnectAttempts: 2,
    reconnectDelayMs: 0,
    fallbackPollIntervalMs: 0,
    fallbackPollMaxMs: 0
  });

  assert.equal(registry.start({
    ...followOptions({ kind: "workflow" }),
    executionId: "execution-1",
    workspaceId: "workspace-1",
    rootId: "root-1"
  }), true);
  assert.equal(registry.start({
    ...followOptions({ kind: "workflow" }),
    executionId: "execution-2",
    rootId: "root-1"
  }), false);
  await waitFor(() => posts.length === 4);

  assert.deepEqual(streamCursors, ["", "2"]);
  assert.match(posts[0].message, /restart_workload/);
  assert.equal(posts[0].attachments[0].actions[0].name, "Approve");
  assert.equal(posts[0].attachments[0].actions[1].name, "Reject");
  const approvalContext = posts[0].attachments[0].actions[0].integration.context;
  assert.deepEqual(Object.keys(approvalContext), ["token"]);
  assert.equal(
    verifyMattermostActionContext(approvalContext.token, "action-secret").externalUserId,
    "mattermost-user-1"
  );
  assert.match(posts[1].message, /cordon_node/);
  assert.match(posts[2].message, /Approval approved/);
  assert.equal(posts[3].message, "All workflow steps completed.");
  assert.equal(commandContextStore.getChatThread("channel-1", "root-1").activeRun, null);
});

test("workflow follower replays an approval when its Mattermost post fails", async () => {
  const cursors = [];
  const posts = [];
  let streamCalls = 0;
  let postCalls = 0;
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.registerChatThread("mattermost-user-1", {
    channelId: "channel-1",
    rootId: "root-1",
    sessionId: "session-1",
    kind: "workflow"
  });
  const registry = createRunFollowerRegistry({
    acornOpsClient: {
      async streamWorkflowExecution(_identity, _executionId, options) {
        cursors.push(options.after);
        streamCalls += 1;
        if (streamCalls === 1) {
          return asyncEvents([
            workflowEvent(1, "approval_requested", {
              runId: "run-1",
              approvalId: "approval-1",
              payload: { toolName: "restart_workload" }
            })
          ]);
        }
        return asyncEvents([
          workflowEvent(1, "approval_requested", {
            runId: "run-1",
            approvalId: "approval-1",
            payload: { toolName: "restart_workload" }
          }),
          workflowEvent(2, "execution_status_changed", {
            runId: "run-1",
            payload: { status: "completed" }
          })
        ]);
      },
      async getWorkflowExecution() {
        return {
          execution: { status: streamCalls > 1 ? "completed" : "running" },
          attempts: [{ id: "run-1" }]
        };
      },
      async getRun() {
        return {
          id: "run-1",
          status: "completed",
          assistantMessage: { content: "Workflow completed." }
        };
      }
    },
    commandContextStore,
    postFollowUp: async (post) => {
      postCalls += 1;
      if (postCalls === 1) {
        throw new Error("Mattermost unavailable");
      }
      posts.push(post);
    },
    logger: quietLogger(),
    reconnectAttempts: 2,
    reconnectDelayMs: 0,
    fallbackPollIntervalMs: 0,
    fallbackPollMaxMs: 0,
    workflowRetryDelayMs: 1
  });

  registry.start({
    ...followOptions({ kind: "workflow" }),
    executionId: "execution-1",
    rootId: "root-1"
  });
  await waitFor(() => posts.length === 2);

  assert.deepEqual(cursors, ["", ""]);
  assert.match(posts[0].message, /Approval required/);
  assert.equal(posts[1].message, "Workflow completed.");
});

test("workflow follower retries terminal delivery before clearing active state", async () => {
  const posts = [];
  let postCalls = 0;
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.registerChatThread("mattermost-user-1", {
    channelId: "channel-1",
    rootId: "root-1",
    sessionId: "session-1",
    kind: "workflow"
  });
  const registry = createRunFollowerRegistry({
    acornOpsClient: {
      async streamWorkflowExecution() {
        return asyncEvents([
          workflowEvent(1, "execution_status_changed", {
            runId: "run-1",
            payload: { status: "completed" }
          })
        ]);
      },
      async getWorkflowExecution() {
        return {
          execution: { status: "completed" },
          attempts: [{ id: "run-1" }]
        };
      },
      async getRun() {
        return {
          id: "run-1",
          status: "completed",
          assistantMessage: { content: "Delivered after retry." }
        };
      }
    },
    commandContextStore,
    postFollowUp: async (post) => {
      postCalls += 1;
      if (postCalls === 1) {
        throw new Error("Mattermost unavailable");
      }
      posts.push(post);
    },
    logger: quietLogger(),
    reconnectAttempts: 1,
    reconnectDelayMs: 0,
    fallbackPollIntervalMs: 0,
    fallbackPollMaxMs: 0,
    workflowRetryDelayMs: 1
  });

  registry.start({
    ...followOptions({ kind: "workflow" }),
    executionId: "execution-1",
    rootId: "root-1"
  });
  await waitFor(() => posts.length === 1);

  assert.equal(postCalls, 2);
  assert.equal(posts[0].message, "Delivered after retry.");
  assert.equal(commandContextStore.getChatThread("channel-1", "root-1").activeRun, null);
});

test("workflow follower retains active state after bounded fallback polling", async () => {
  let streamCalls = 0;
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.registerChatThread("mattermost-user-1", {
    channelId: "channel-1",
    rootId: "root-1",
    sessionId: "session-1",
    kind: "workflow"
  });
  const registry = createRunFollowerRegistry({
    acornOpsClient: {
      async streamWorkflowExecution() {
        streamCalls += 1;
        return asyncEvents([]);
      },
      async getWorkflowExecution() {
        return {
          execution: { status: "running" },
          attempts: [{ id: "run-1" }]
        };
      }
    },
    commandContextStore,
    postFollowUp: async () => {},
    logger: quietLogger(),
    reconnectAttempts: 0,
    reconnectDelayMs: 0,
    fallbackPollIntervalMs: 0,
    fallbackPollMaxMs: 0,
    workflowRetryDelayMs: 1
  });

  registry.start({
    ...followOptions({ kind: "workflow" }),
    executionId: "execution-1",
    rootId: "root-1"
  });
  await waitFor(() => streamCalls >= 2);

  assert.equal(registry.has("mattermost-user-1", {
    channelId: "channel-1",
    rootId: "root-1"
  }), true);
  assert.equal(
    commandContextStore.getChatThread("channel-1", "root-1").activeRun.executionId,
    "execution-1"
  );
  registry.abort("mattermost-user-1", {
    channelId: "channel-1",
    rootId: "root-1"
  });
});

test("run follower abort prevents stale final posts", async () => {
  let releaseStream;
  const streamStarted = new Promise((resolve) => {
    releaseStream = resolve;
  });
  const posts = [];
  const commandContextStore = createInMemoryCommandContextStore();
  const registry = createRunFollowerRegistry({
    acornOpsClient: {
      async streamRun() {
        return asyncEvents([
          streamStarted.then(() => ({ event: "run_completed", data: {} }))
        ]);
      },
      async getRun() {
        return {
          id: "run-1",
          status: "completed"
        };
      },
      async listSessionMessages() {
        return {
          items: [
            {
              role: "assistant",
              runId: "run-1",
              content: "late answer"
            }
          ]
        };
      }
    },
    commandContextStore,
    postFollowUp: async (post) => {
      posts.push(post);
    },
    logger: quietLogger(),
    reconnectDelayMs: 0,
    fallbackPollIntervalMs: 0,
    fallbackPollMaxMs: 0
  });

  registry.start(followOptions());
  registry.abort("mattermost-user-1");
  releaseStream();
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.deepEqual(posts, []);
  assert.equal(commandContextStore.get("mattermost-user-1").activeRun, null);
});

test("run follower checks run state and reconnects after a dropped stream", async () => {
  let streamCalls = 0;
  const posts = [];
  const registry = createRunFollowerRegistry({
    acornOpsClient: {
      async streamRun() {
        streamCalls += 1;
        if (streamCalls === 1) {
          return asyncEvents([]);
        }
        return asyncEvents([
          { event: "run_completed", data: {} }
        ]);
      },
      async getRun() {
        return {
          id: "run-1",
          status: streamCalls === 1 ? "running" : "completed"
        };
      },
      async listSessionMessages() {
        return {
          items: [
            {
              role: "assistant",
              runId: "run-1",
              content: "Reconnected answer."
            }
          ]
        };
      }
    },
    commandContextStore: createInMemoryCommandContextStore(),
    postFollowUp: async (post) => {
      posts.push(post);
    },
    logger: quietLogger(),
    reconnectAttempts: 2,
    reconnectDelayMs: 0,
    fallbackPollIntervalMs: 0,
    fallbackPollMaxMs: 0
  });

  registry.start(followOptions());
  await waitFor(() => posts.length === 1);

  assert.equal(streamCalls, 2);
  assert.equal(posts[0].message, "Reconnected answer.");
});

function followOptions({ runId = "run-1", kind = "chat" } = {}) {
  return {
    kind,
    identity: {
      externalUserId: "mattermost-user-1"
    },
    sessionId: "session-1",
    runId,
    messageId: "message-1",
    channelId: "channel-1"
  };
}

function terminalStreamClient(event) {
  return {
    async streamRun() {
      return asyncEvents([
        { event, data: {} }
      ]);
    }
  };
}

function workflowEvent(id, type, fields = {}) {
  return {
    event: "workflow_execution",
    id: String(id),
    data: {
      id,
      type,
      ...fields
    }
  };
}

async function* asyncEvents(events) {
  for (const event of events) {
    yield await event;
  }
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(predicate(), true);
}

function quietLogger() {
  return {
    log() {},
    error() {}
  };
}
