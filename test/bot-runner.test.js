import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { createInMemoryCommandContextStore } from "../src/bot/commands/context.js";
import {
  createMattermostBotRunner,
  handlePostedEvent
} from "../src/bot/runner.js";

test("runner authenticates websocket open with bot token", async () => {
  const socket = new FakeSocket();
  const runner = createMattermostBotRunner({
    client: fakeClient({ token: "bot-token", websocketUrl: "ws://mattermost/api/v4/websocket" }),
    websocketFactory: (url) => {
      assert.equal(url, "ws://mattermost/api/v4/websocket");
      return socket;
    },
    logger: quietLogger()
  });

  await runner.start();
  socket.emitOpen();

  assert.deepEqual(JSON.parse(socket.sent[0]), {
    seq: 1,
    action: "authentication_challenge",
    data: {
      token: "bot-token"
    }
  });
});

test("runner tolerates websocket authentication challenge", async () => {
  const socket = new FakeSocket();
  const runner = createMattermostBotRunner({
    client: fakeClient({ token: "bot-token" }),
    websocketFactory: () => socket,
    logger: quietLogger()
  });

  await runner.start();
  socket.emitMessage({
    action: "authentication_challenge"
  });

  assert.equal(socket.sent.length, 1);
});

test("handlePostedEvent responds to direct message posts in the main timeline", async () => {
  const posts = [];
  const client = fakeClient({
    createPost: async (post) => {
      posts.push(post);
      return { id: "reply-1", ...post };
    }
  });

  const result = await handlePostedEvent({
    client,
    acornOpsClient: {
      async resolveExternalIntegrationLink(input) {
        assert.deepEqual(input, externalIdentity("user-1"));
        return { status: "unlinked" };
      }
    },
    botUser: {
      id: "bot",
      username: "acorn-ops-bot"
    },
    event: {
      event: "posted",
      data: {
        channel_type: "D",
        sender_name: "alice",
        post: JSON.stringify({
          id: "post-1",
          channel_id: "channel-1",
          user_id: "user-1",
          message: "!status"
        })
      }
    },
    logger: quietLogger()
  });

  assert.equal(result.id, "reply-1");
  assert.equal(posts[0].channelId, "channel-1");
  assert.equal(posts[0].rootId, "");
  assert.match(posts[0].message, /not linked/);
  assert.match(posts[0].message, /Run `!login`/);
  assert.doesNotMatch(posts[0].message, /user-1/);
});

test("handlePostedEvent skips unmentioned channel posts", async () => {
  const client = fakeClient({
    createPost: async () => {
      throw new Error("createPost should not be called");
    }
  });

  const result = await handlePostedEvent({
    client,
    botUser: {
      id: "bot",
      username: "acorn-ops-bot"
    },
    event: {
      event: "posted",
      data: {
        channel_type: "O",
        post: JSON.stringify({
          id: "post-1",
          channel_id: "channel-1",
          user_id: "user-1",
          message: "!status"
        })
      }
    },
    logger: quietLogger()
  });

  assert.equal(result, null);
});

test("handlePostedEvent creates AcornOps account link for direct message login posts", async () => {
  const posts = [];
  const client = fakeClient({
    createPost: async (post) => {
      posts.push(post);
      return { id: "reply-1", ...post };
    }
  });

  const result = await handlePostedEvent({
    client,
    acornOpsClient: {
      async createExternalIntegrationLink(input) {
        assert.deepEqual(input, linkIdentity("user-1"));
        return {
          linkUrl: "https://console.acornops.dev/integrations/external/link?token=intlink_123",
          expiresAt: "2026-06-09T00:10:00.000Z"
        };
      }
    },
    botUser: {
      id: "bot",
      username: "acorn-ops-bot"
    },
    event: {
      event: "posted",
      data: {
        channel_type: "D",
        sender_name: "alice",
        post: JSON.stringify({
          id: "post-1",
          channel_id: "channel-1",
          user_id: "user-1",
          message: "!login"
        })
      }
    },
    logger: quietLogger()
  });

  assert.equal(result.id, "reply-1");
  assert.match(posts[0].message, /AcornOps account link:/);
  assert.match(posts[0].message, /intlink_123/);
});

test("handlePostedEvent lists workspaces for direct message posts", async () => {
  const posts = [];
  const client = fakeClient({
    createPost: async (post) => {
      posts.push(post);
      return { id: "reply-1", ...post };
    }
  });

  const result = await handlePostedEvent({
    client,
    acornOpsClient: {
      async listWorkspaces(input) {
        assert.deepEqual(input, externalIdentity("user-1"));
        return {
          items: [
            {
              id: "workspace-1",
              name: "Platform",
              plan: { name: "Team" },
              quota: {
                members: { used: 0, limit: 10 },
                kubernetesClusters: { used: 0, limit: 3 },
                virtualMachines: { used: 0, limit: 5 }
              }
            }
          ]
        };
      }
    },
    botUser: {
      id: "bot",
      username: "acorn-ops-bot"
    },
    event: {
      event: "posted",
      data: {
        channel_type: "D",
        sender_name: "alice",
        post: JSON.stringify({
          id: "post-1",
          channel_id: "channel-1",
          user_id: "user-1",
          message: "!workspaces"
        })
      }
    },
    logger: quietLogger()
  });

  assert.equal(result.id, "reply-1");
  assert.match(posts[0].message, /AcornOps workspaces:/);
  assert.match(posts[0].message, /1\. Platform \(workspace-1\)/);
});

test("handlePostedEvent reuses workspace context across direct message posts", async () => {
  const posts = [];
  const commandContextStore = createInMemoryCommandContextStore();
  const client = fakeClient({
    createPost: async (post) => {
      posts.push(post);
      return { id: `reply-${posts.length}`, ...post };
    }
  });
  const acornOpsClient = {
    async listWorkspaces(input) {
      assert.deepEqual(input, externalIdentity("user-1"));
      return {
        items: [
          {
            id: "workspace-1",
            name: "Platform"
          }
        ]
      };
    },
    async getWorkspace(input, workspaceId) {
      assert.deepEqual(input, externalIdentity("user-1"));
      assert.equal(workspaceId, "workspace-1");
      return {
        id: "workspace-1",
        name: "Platform"
      };
    },
    async listKubernetesClusters(input, workspaceId) {
      assert.deepEqual(input, externalIdentity("user-1"));
      assert.equal(workspaceId, "workspace-1");
      return {
        items: [
          {
            id: "cluster-1",
            name: "Prod",
            status: "ready"
          }
        ]
      };
    }
  };

  await handlePostedEvent({
    client,
    acornOpsClient,
    commandContextStore,
    botUser: {
      id: "bot",
      username: "acorn-ops-bot"
    },
    event: postedEvent("user-1", "!workspaces"),
    logger: quietLogger()
  });
  await handlePostedEvent({
    client,
    acornOpsClient,
    commandContextStore,
    botUser: {
      id: "bot",
      username: "acorn-ops-bot"
    },
    event: postedEvent("user-1", "!workspace 1"),
    logger: quietLogger()
  });
  const result = await handlePostedEvent({
    client,
    acornOpsClient,
    commandContextStore,
    botUser: {
      id: "bot",
      username: "acorn-ops-bot"
    },
    event: postedEvent("user-1", "!clusters"),
    logger: quietLogger()
  });

  assert.equal(result.id, "reply-3");
  assert.match(posts[1].message, /Current workspace updated/);
  assert.match(posts[2].message, /AcornOps clusters:/);
  assert.match(posts[2].message, /Prod \(cluster-1\)/);
});

test("handlePostedEvent starts a run follower for pending chat answers", async () => {
  const previousAttempts = process.env.CHAT_RUN_POLL_ATTEMPTS;
  const previousInterval = process.env.CHAT_RUN_POLL_INTERVAL_MS;
  process.env.CHAT_RUN_POLL_ATTEMPTS = "1";
  process.env.CHAT_RUN_POLL_INTERVAL_MS = "0";

  try {
    const posts = [];
    const started = [];
    const commandContextStore = createInMemoryCommandContextStore();
    commandContextStore.selectWorkspace("user-1", {
      id: "workspace-1",
      name: "Platform"
    });
    commandContextStore.selectCluster("user-1", {
      id: "cluster-1",
      name: "Prod"
    });
    commandContextStore.registerChatThread("user-1", {
      channelId: "channel-1",
      rootId: "root-chat-1",
      sessionId: "session-1",
      sessionName: "Investigate Prod",
      title: "Investigate Prod",
      number: 1,
      status: "open"
    });

    await handlePostedEvent({
      client: fakeClient({
        createPost: async (post) => {
          posts.push(post);
          return { id: `reply-${posts.length}`, ...post };
        }
      }),
      acornOpsClient: {
        async postSessionMessage(_input, sessionId) {
          assert.equal(sessionId, "session-1");
          return {
            message_id: "message-1",
            run_id: "run-1"
          };
        },
        async getRun() {
          return {
            id: "run-1",
            status: "running",
            sessionId: "session-1"
          };
        }
      },
      commandContextStore,
      runFollowerRegistry: {
        start(options) {
          started.push(options);
          return true;
        },
        abort() {}
      },
      botUser: {
        id: "bot",
        username: "acorn-ops-bot"
      },
      event: postedEvent("user-1", "why is the pod unhealthy?", {
        postId: "post-chat-1",
        rootId: "root-chat-1"
      }),
      logger: quietLogger()
    });

    assert.match(posts[0].message, /I'll post the answer here when it's ready/);
    assert.deepEqual(started, [
      {
        type: "followRun",
        identity: {
          externalUserId: "user-1"
        },
        sessionId: "session-1",
        runId: "run-1",
        messageId: "message-1",
        channelId: "channel-1",
        rootId: "root-chat-1"
      }
    ]);
  } finally {
    restoreEnvValue("CHAT_RUN_POLL_ATTEMPTS", previousAttempts);
    restoreEnvValue("CHAT_RUN_POLL_INTERVAL_MS", previousInterval);
  }
});

test("handlePostedEvent aborts the active run before posting chat end confirmation", async () => {
  const posts = [];
  const aborted = [];
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.registerChatThread("user-1", {
    channelId: "channel-1",
    rootId: "root-chat-1",
    sessionId: "session-1",
    sessionName: "Investigate Prod",
    title: "Investigate Prod",
    number: 1,
    status: "open"
  });
  commandContextStore.rememberActiveRunForChat("channel-1", "root-chat-1", {
    id: "run-1",
    sessionId: "session-1",
    status: "streaming"
  });

  await handlePostedEvent({
    client: fakeClient({
      createPost: async (post) => {
        posts.push(post);
        return { id: "reply-1", ...post };
      }
    }),
    commandContextStore,
    runFollowerRegistry: {
      start() {
        throw new Error("start should not be called");
      },
      abort(externalUserId, options) {
        aborted.push({ externalUserId, ...options });
      }
    },
    botUser: {
      id: "bot",
      username: "acorn-ops-bot"
    },
    event: postedEvent("user-1", "!chat end", { rootId: "root-chat-1" }),
    logger: quietLogger()
  });

  assert.deepEqual(aborted, [
    {
      externalUserId: "user-1",
      channelId: "channel-1",
      rootId: "root-chat-1"
    }
  ]);
  assert.match(posts[0].message, /Chat thread closed/);
});

test("handlePostedEvent creates and follows a workflow thread with the exact root post", async () => {
  const posts = [];
  const started = [];
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.selectWorkspace("user-1", {
    id: "workspace-1",
    name: "Platform"
  });
  commandContextStore.selectCluster("user-1", {
    id: "cluster-1",
    name: "Prod"
  });

  await handlePostedEvent({
    client: fakeClient({
      createPost: async (post) => {
        posts.push(post);
        return { id: `reply-${posts.length}`, ...post };
      }
    }),
    acornOpsClient: {
      async listWorkflows() {
        return {
          items: [{
            id: "cluster-triage",
            name: "Cluster triage",
            status: "active",
            inputs: [],
            starterPrompt: "Triage the selected cluster.",
            policy: { mode: "read_only", approvalRequirements: [] },
            steps: [{
              requiredInputs: [],
              contextGrants: ["workspace_metadata", "target_inventory"],
              approvalRequired: false,
              targetBinding: {
                type: "selected_cluster",
                targetType: "kubernetes",
                inputName: "clusterId"
              }
            }]
          }]
        };
      },
      async createWorkflowSession() {
        return { session: { id: "workflow-session-1" } };
      },
      async postWorkflowSessionMessage() {
        return {
          message_id: "workflow-message-1",
          run_id: "run-1",
          status: "queued"
        };
      }
    },
    commandContextStore,
    runFollowerRegistry: {
      start(options) {
        started.push(options);
        return true;
      },
      abort() {}
    },
    botUser: {
      id: "bot",
      username: "acorn-ops-bot"
    },
    event: postedEvent("user-1", "!workflow run 1"),
    logger: quietLogger()
  });

  assert.equal(
    posts[0].message,
    "Workflow “Cluster triage” was launched successfully. Follow the thread below for results and replies."
  );
  assert.equal(posts[1].message, "**Workflow launched: Cluster triage**");
  const thread = commandContextStore.getChatThread("channel-1", "reply-2");
  assert.equal(thread.kind, "workflow");
  assert.equal(thread.workflowId, "cluster-triage");
  assert.deepEqual(thread.workflowInputs, { clusterId: "cluster-1" });
  assert.deepEqual(started, [{
    kind: "workflow",
    identity: { externalUserId: "user-1" },
    sessionId: "workflow-session-1",
    runId: "run-1",
    messageId: "workflow-message-1",
    channelId: "channel-1",
    rootId: "reply-2"
  }]);
});

function fakeClient(overrides = {}) {
  return {
    token: overrides.token ?? "token",
    getMe: overrides.getMe ?? (async () => ({
      id: "bot",
      username: "acorn-ops-bot"
    })),
    websocketUrl: () => overrides.websocketUrl ?? "ws://mattermost/api/v4/websocket",
    createPost: overrides.createPost ?? (async (post) => post)
  };
}

function externalIdentity(externalUserId = "mattermost-user-1") {
  return {
    externalUserId
  };
}

function linkIdentity(externalUserId = "mattermost-user-1") {
  return {
    ...externalIdentity(externalUserId),
    externalDisplayName: "alice"
  };
}

function quietLogger() {
  return {
    log() {},
    error() {}
  };
}

function restoreEnvValue(name, previousValue) {
  if (previousValue === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = previousValue;
  }
}

function postedEvent(userId, message, { postId = `post-${message}`, rootId = "" } = {}) {
  return {
    event: "posted",
    data: {
      channel_type: "D",
      sender_name: "alice",
      post: JSON.stringify({
        id: postId,
        channel_id: "channel-1",
        root_id: rootId,
        user_id: userId,
        message
      })
    }
  };
}

class FakeSocket extends EventEmitter {
  sent = [];

  addEventListener(event, listener) {
    this.on(event, listener);
  }

  send(message) {
    this.sent.push(message);
  }

  emitOpen() {
    this.emit("open", {});
  }

  emitMessage(data) {
    this.emit("message", {
      data: JSON.stringify(data)
    });
  }
}
