import assert from "node:assert/strict";
import test from "node:test";
import { MattermostClient } from "../src/bot/mattermost-client.js";

test("websocketUrl maps http to ws endpoint", () => {
  const client = new MattermostClient({
    baseUrl: "http://localhost:8065",
    token: "token",
    fetchImpl: async () => okResponse({})
  });

  assert.equal(client.websocketUrl(), "ws://localhost:8065/api/v4/websocket");
});

test("getMe calls Mattermost users API and parses JSON", async () => {
  const calls = [];
  const client = new MattermostClient({
    baseUrl: "http://mattermost",
    token: "bot-token",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return okResponse({ id: "user-1", username: "bot" });
    }
  });

  const me = await client.getMe();

  assert.deepEqual(me, { id: "user-1", username: "bot" });
  assert.equal(calls[0].url, "http://mattermost/api/v4/users/me");
  assert.equal(calls[0].options.headers.authorization, "Bearer bot-token");
});

test("createPost calls Mattermost posts API with bot token", async () => {
  const calls = [];
  const client = new MattermostClient({
    baseUrl: "http://mattermost",
    token: "bot-token",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return okResponse({ id: "post-1" });
    }
  });

  const post = await client.createPost({
    channelId: "channel-1",
    message: "hello",
    rootId: "root-1"
  });

  assert.deepEqual(post, { id: "post-1" });
  assert.equal(calls[0].url, "http://mattermost/api/v4/posts");
  assert.equal(calls[0].options.headers.authorization, "Bearer bot-token");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    channel_id: "channel-1",
    message: "hello",
    root_id: "root-1"
  });
});

test("createPost can include props and attachments", async () => {
  const calls = [];
  const client = new MattermostClient({
    baseUrl: "http://mattermost",
    token: "bot-token",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return okResponse({ id: "post-1" });
    }
  });

  await client.createPost({
    channelId: "channel-1",
    message: "choose",
    props: { from_bot: true },
    attachments: [
      {
        text: "Choose workspace",
        actions: [{ name: "1" }]
      }
    ]
  });

  assert.deepEqual(JSON.parse(calls[0].options.body), {
    channel_id: "channel-1",
    message: "choose",
    root_id: "",
    props: {
      from_bot: true,
      attachments: [
        {
          text: "Choose workspace",
          actions: [{ name: "1" }]
        }
      ]
    }
  });
});

test("request returns the raw response for non-JSON handling", async () => {
  const response = rawResponse({ status: 202, text: "accepted" });
  const client = new MattermostClient({
    baseUrl: "http://mattermost",
    token: "bot-token",
    fetchImpl: async () => response
  });

  const result = await client.request("DELETE", "/api/v4/posts/post-1");

  assert.equal(result, response);
});

function okResponse(json) {
  return {
    ok: true,
    async json() {
      return json;
    }
  };
}

function rawResponse({ status, text }) {
  return {
    ok: true,
    status,
    async text() {
      return text;
    }
  };
}
