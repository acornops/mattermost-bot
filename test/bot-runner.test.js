import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { createMattermostBotRunner, handlePostedEvent } from "../src/bot/runner.js";

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

test("handlePostedEvent starts AcornOps OIDC login for direct message login posts", async () => {
  const posts = [];
  const pendingLogins = new Map();
  const client = fakeClient({
    createPost: async (post) => {
      posts.push(post);
      return { id: "reply-1", ...post };
    }
  });

  const result = await handlePostedEvent({
    client,
    acornOpsClient: {
      oidcLoginUrl(input) {
        assert.deepEqual(input, { returnTo: "/api/v1/me" });
        return "http://acornops/api/v1/auth/oidc/login?return_to=%2Fapi%2Fv1%2Fme";
      }
    },
    authStore: {
      createPendingLogin(input) {
        const record = {
          id: "pending-1",
          ...input,
          createdAt: "2026-06-04T00:00:00.000Z",
          expiresAt: "2026-06-04T00:10:00.000Z"
        };
        pendingLogins.set(input.mattermostUserId, record);
        return record;
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
  assert.match(posts[0].message, /AcornOps browser login link:/);
  assert.equal(pendingLogins.get("user-1").id, "pending-1");
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

function quietLogger() {
  return {
    log() {},
    error() {}
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
