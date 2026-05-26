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

function okResponse(json) {
  return {
    ok: true,
    async json() {
      return json;
    }
  };
}
