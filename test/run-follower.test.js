import assert from "node:assert/strict";
import test from "node:test";
import { createInMemoryCommandContextStore } from "../src/bot/commands/context.js";
import { createRunFollowerRegistry } from "../src/bot/chat/follower.js";

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

function followOptions({ runId = "run-1" } = {}) {
  return {
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
