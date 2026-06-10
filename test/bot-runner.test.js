import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
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
      async resolveMattermostLink(input) {
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
  assert.match(posts[0].message, /Run `\/login`/);
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
      async createMattermostLink(input) {
        assert.deepEqual(input, mattermostIdentity("user-1"));
        return {
          linkUrl: "https://console.acornops.dev/integrations/mattermost/link?token=mmlink_123",
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
  assert.match(posts[0].message, /mmlink_123/);
});

test("extractMattermostIdentity reads only observed post author id", () => {
  assert.deepEqual(extractMattermostIdentity({
    post: {
      user_id: "mattermost-user-1",
      props: {
        mattermostUserId: "user-supplied-user-id"
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

function mattermostIdentity(mattermostUserId = "mattermost-user-1") {
  return {
    mattermostUserId
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
