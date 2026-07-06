import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createInMemoryCommandContextStore } from "../src/bot/commands/context.js";
import {
  createBotHttpServer,
  handleAcornOpsRouteWebhook,
  handleMattermostAction,
  hashSecret,
  routeTokenFromPath
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

test("bot HTTP server no longer matches the old global webhook endpoint", () => {
  assert.equal(routeTokenFromPath("/acornops/webhooks"), "");
  assert.equal(routeTokenFromPath("/acornops/webhooks/routes/route-token"), "route-token");
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
  assert.match(result.body.ephemeral_text, /Workspace changed successfully/);
});

test("Mattermost action selects target for the requesting user", () => {
  const commandContextStore = createInMemoryCommandContextStore();
  const result = handleMattermostAction({
    payload: {
      user_id: "user-1",
      context: {
        action: "select_target",
        secret: "action-secret",
        externalUserId: "user-1",
        target: {
          id: "target-1",
          name: "Prod cluster",
          type: "kubernetes"
        }
      }
    },
    mattermostActionSecret: "action-secret",
    commandContextStore
  });

  assert.equal(result.status, 200);
  assert.deepEqual(commandContextStore.get("user-1").currentTarget, {
    id: "target-1",
    name: "Prod cluster",
    type: "kubernetes",
    source: "target"
  });
  assert.match(result.body.ephemeral_text, /Target changed successfully/);
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

  assert.equal(result.status, 200);
  assert.match(result.body.error.message, /not authorized/);
  assert.match(result.body.ephemeral_text, /not authorized/);
});

test("Mattermost action returns user-facing failures for invalid selections", () => {
  const wrongUser = handleMattermostAction({
    payload: {
      user_id: "user-2",
      context: {
        action: "select_target",
        externalUserId: "user-1",
        target: {
          id: "target-1"
        }
      }
    },
    commandContextStore: createInMemoryCommandContextStore()
  });
  const missingTarget = handleMattermostAction({
    payload: {
      user_id: "user-1",
      context: {
        action: "select_target",
        externalUserId: "user-1",
        target: {}
      }
    },
    commandContextStore: createInMemoryCommandContextStore()
  });

  assert.equal(wrongUser.status, 200);
  assert.match(wrongUser.body.ephemeral_text, /Only the Mattermost user/);
  assert.equal(missingTarget.status, 200);
  assert.match(missingTarget.body.ephemeral_text, /Target selection failed/);
});

test("Mattermost action rejects stale target buttons after workspace changes", () => {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.selectWorkspace("user-1", {
    id: "workspace-2",
    name: "Operations"
  });

  const result = handleMattermostAction({
    payload: {
      user_id: "user-1",
      context: {
        action: "select_target",
        externalUserId: "user-1",
        workspace: {
          id: "workspace-1",
          name: "Platform"
        },
        target: {
          id: "target-1",
          name: "Prod cluster",
          type: "kubernetes"
        }
      }
    },
    commandContextStore
  });

  assert.equal(result.status, 200);
  assert.match(result.body.ephemeral_text, /current workspace has changed/);
  assert.equal(commandContextStore.get("user-1").currentTarget, null);
});

test("AcornOps route webhook verifies signature, deduplicates, and posts to route destination", async () => {
  const posts = [];
  const commandContextStore = createInMemoryCommandContextStore();
  const routeToken = "route-token";
  const signingSecret = "webhook-secret";
  commandContextStore.upsertWebhookRoute("user-1", {
    channelId: "channel-1",
    rootId: "root-1",
    routeTokenHash: hashSecret(routeToken),
    signingSecret,
    deliveryUrl: `https://bot.example.com/acornops/webhooks/routes/${routeToken}`
  });
  const body = {
    id: "event-1",
    type: "run.failed.v1",
    workspaceId: "workspace-1",
    subject: { type: "run", id: "run-1" },
    data: {
      errorMessage: "Provider unavailable"
    }
  };
  const first = await handleAcornOpsRouteWebhook({
    routeToken,
    ...signedWebhookInput(body, signingSecret),
    commandContextStore,
    mattermostClient: fakeMattermostClient(posts)
  });
  const duplicate = await handleAcornOpsRouteWebhook({
    routeToken,
    ...signedWebhookInput(body, signingSecret),
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

test("AcornOps route webhook rejects stale or invalid signatures", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.upsertWebhookRoute("user-1", {
    channelId: "channel-1",
    routeTokenHash: hashSecret("route-token"),
    signingSecret: "webhook-secret"
  });
  const result = await handleAcornOpsRouteWebhook({
    routeToken: "route-token",
    rawBody: JSON.stringify({ id: "event-1" }),
    headers: {
      "acornops-timestamp": "1",
      "acornops-signature": "v1=bad"
    },
    commandContextStore,
    mattermostClient: fakeMattermostClient()
  });

  assert.equal(result.status, 401);
});

test("AcornOps route webhook rejects unknown route tokens and missing event ids", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  const missingRoute = await handleAcornOpsRouteWebhook({
    routeToken: "missing",
    ...signedWebhookInput({ id: "event-1" }, "webhook-secret"),
    commandContextStore,
    mattermostClient: fakeMattermostClient()
  });

  commandContextStore.upsertWebhookRoute("user-1", {
    channelId: "channel-1",
    routeTokenHash: hashSecret("route-token"),
    signingSecret: "webhook-secret"
  });
  const missingEvent = await handleAcornOpsRouteWebhook({
    routeToken: "route-token",
    ...signedWebhookInput({ type: "run.failed.v1" }, "webhook-secret"),
    commandContextStore,
    mattermostClient: fakeMattermostClient()
  });

  assert.equal(missingRoute.status, 404);
  assert.equal(missingEvent.status, 400);
});

function signedWebhookInput(body, secret) {
  const rawBody = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const headers = {
      "acornops-timestamp": timestamp,
      "acornops-signature": `v1=${signature}`
  };
  if (body.id) {
    headers["acornops-event-id"] = body.id;
  }
  return {
    rawBody,
    headers
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
