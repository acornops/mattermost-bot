import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createInMemoryCommandContextStore } from "../src/bot/commands/context.js";
import {
  createBotHttpServer,
  handleAcornOpsWebhook,
  handleMattermostAction
} from "../src/bot/server.js";

test("bot HTTP server can be constructed without listening when port is disabled", async () => {
  const botServer = createBotHttpServer({
    port: 0,
    commandContextStore: createInMemoryCommandContextStore(),
    mattermostClient: fakeMattermostClient(),
    logger: quietLogger()
  });

  assert.equal(await botServer.start(), null);
});

test("Mattermost action selects workspace for the requesting user", () => {
  const commandContextStore = createInMemoryCommandContextStore();
  const result = handleMattermostAction({
    payload: {
      user_id: "user-1",
      context: {
        action: "select_workspace",
        secret: "action-secret",
        externalUserId: "user-1",
        workspace: {
          id: "workspace-1",
          name: "Platform"
        }
      }
    },
    mattermostActionSecret: "action-secret",
    commandContextStore
  });

  assert.equal(result.status, 200);
  assert.deepEqual(commandContextStore.get("user-1").currentWorkspace, {
    id: "workspace-1",
    name: "Platform"
  });
  assert.match(result.body.ephemeral_text, /Current workspace updated/);
});

test("Mattermost action rejects invalid secrets", () => {
  const result = handleMattermostAction({
    payload: {
      user_id: "user-1",
      context: {
        action: "select_workspace",
        secret: "wrong"
      }
    },
    mattermostActionSecret: "action-secret",
    commandContextStore: createInMemoryCommandContextStore()
  });

  assert.equal(result.status, 401);
});

test("AcornOps webhook verifies signature, deduplicates, and posts to user route", async () => {
  const posts = [];
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.upsertWebhookRoute("user-1", {
    channelId: "channel-1",
    rootId: "root-1"
  });
  const body = {
    id: "event-1",
    type: "run.failed.v1",
    workspaceId: "workspace-1",
    subject: { type: "run", id: "run-1" },
    data: {
      externalUserId: "user-1",
      errorMessage: "Provider unavailable"
    }
  };
  const first = await handleAcornOpsWebhook({
    ...signedWebhookInput(body, "webhook-secret"),
    acornOpsWebhookSecret: "webhook-secret",
    commandContextStore,
    mattermostClient: fakeMattermostClient(posts)
  });
  const duplicate = await handleAcornOpsWebhook({
    ...signedWebhookInput(body, "webhook-secret"),
    acornOpsWebhookSecret: "webhook-secret",
    commandContextStore,
    mattermostClient: fakeMattermostClient(posts)
  });

  assert.equal(first.status, 202);
  assert.deepEqual(duplicate.body, { status: "duplicate" });
  assert.equal(posts.length, 1);
  assert.equal(posts[0].channelId, "channel-1");
  assert.equal(posts[0].rootId, "root-1");
  assert.match(posts[0].message, /run.failed.v1/);
  assert.match(posts[0].message, /Provider unavailable/);
});

test("AcornOps webhook rejects stale or invalid signatures", async () => {
  const result = await handleAcornOpsWebhook({
    rawBody: JSON.stringify({ id: "event-1" }),
    headers: {
      "acornops-timestamp": "1",
      "acornops-signature": "v1=bad"
    },
    acornOpsWebhookSecret: "webhook-secret",
    commandContextStore: createInMemoryCommandContextStore(),
    mattermostClient: fakeMattermostClient()
  });

  assert.equal(result.status, 401);
});

function signedWebhookInput(body, secret) {
  const rawBody = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return {
    rawBody,
    headers: {
      "acornops-event-id": body.id,
      "acornops-timestamp": timestamp,
      "acornops-signature": `v1=${signature}`
    }
  };
}

function fakeMattermostClient(posts = []) {
  return {
    async createPost(post) {
      posts.push(post);
      return { id: "post-1" };
    }
  };
}

function quietLogger() {
  return {
    log() {},
    error() {}
  };
}
