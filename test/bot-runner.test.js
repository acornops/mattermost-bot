import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { createInMemoryCommandContextStore } from "../src/bot/command-context.js";
import {
  createMattermostBotRunner,
  extractMattermostIdentity,
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
        assert.deepEqual(input, mattermostIdentity("user-1"));
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
          message: "status"
        })
      }
    },
    logger: quietLogger()
  });

  assert.equal(result.id, "reply-1");
  assert.equal(posts[0].channelId, "channel-1");
  assert.equal(posts[0].rootId, undefined);
  assert.match(posts[0].message, /alice \(user-1\)/);
  assert.match(posts[0].message, /not linked/);
  assert.match(posts[0].message, /Run `login`/);
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
          message: "status"
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
          message: "login"
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
        assert.deepEqual(input, mattermostIdentity("user-1"));
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
          message: "workspaces"
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
      assert.deepEqual(input, mattermostIdentity("user-1"));
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
      assert.deepEqual(input, mattermostIdentity("user-1"));
      assert.equal(workspaceId, "workspace-1");
      return {
        id: "workspace-1",
        name: "Platform"
      };
    },
    async listKubernetesClusters(input, workspaceId) {
      assert.deepEqual(input, mattermostIdentity("user-1"));
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
    event: postedEvent("user-1", "workspaces"),
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
    event: postedEvent("user-1", "workspace 1"),
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
    event: postedEvent("user-1", "clusters"),
    logger: quietLogger()
  });

  assert.equal(result.id, "reply-3");
  assert.match(posts[1].message, /Current workspace updated/);
  assert.match(posts[2].message, /AcornOps clusters:/);
  assert.match(posts[2].message, /Prod \(cluster-1\)/);
});

test("extractMattermostIdentity reads only observed post author id", () => {
  assert.deepEqual(extractMattermostIdentity({
    post: {
      user_id: "mattermost-user-1",
      props: {
        externalUserId: "user-supplied-user-id",
        mattermostUserId: "legacy-user-supplied-user-id"
      }
    }
  }), mattermostIdentity());
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

function mattermostIdentity(externalUserId = "mattermost-user-1") {
  return {
    externalUserId
  };
}

function linkIdentity(externalUserId = "mattermost-user-1") {
  return {
    ...mattermostIdentity(externalUserId),
    externalDisplayName: "alice"
  };
}

function quietLogger() {
  return {
    log() {},
    error() {}
  };
}

function postedEvent(userId, message) {
  return {
    event: "posted",
    data: {
      channel_type: "D",
      sender_name: "alice",
      post: JSON.stringify({
        id: `post-${message}`,
        channel_id: "channel-1",
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
