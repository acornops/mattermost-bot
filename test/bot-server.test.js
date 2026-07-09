import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createInMemoryCommandContextStore } from "../src/bot/commands/context.js";
import {
  createBotHttpServer,
  handleAcornOpsRouteWebhook,
  handleMattermostAction,
  hashSecret,
  postMattermostActionResponse,
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
  assert.deepEqual(result.body, {});
  assert.match(result.message, /Workspace changed successfully/);
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
  assert.deepEqual(result.body, {});
  assert.match(result.message, /Target changed successfully/);
});

test("Mattermost action response posts one visible callback message in the main conversation", async () => {
  const posts = [];
  await postMattermostActionResponse({
    payload: {
      channel_id: "channel-1",
      post_id: "post-1"
    },
    result: {
      status: 200,
      body: {},
      message: "Target changed successfully: Prod cluster"
    },
    mattermostClient: fakeMattermostClient(posts)
  });

  assert.deepEqual(posts, [
    {
      channelId: "channel-1",
      message: "Target changed successfully: Prod cluster"
    }
  ]);
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
  assert.deepEqual(result.body, {});
  assert.match(result.message, /not authorized/);
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
  assert.deepEqual(wrongUser.body, {});
  assert.match(wrongUser.message, /Only the Mattermost user/);
  assert.equal(missingTarget.status, 200);
  assert.deepEqual(missingTarget.body, {});
  assert.match(missingTarget.message, /Target selection failed/);
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
  assert.deepEqual(result.body, {});
  assert.match(result.message, /current workspace has changed/);
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
    deliveryUrl: `https://bot.example.com/acornops/webhooks/routes/${routeToken}`,
    subscriptions: [
      {
        workspaceId: "workspace-1",
        webhookId: "webhook-1",
        eventTypes: ["run.failed.v1"],
        signingSecret
      }
    ]
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
  assert.match(posts[0].message, /AcornOps info alert/);
  assert.match(posts[0].message, /run.failed.v1/);
  assert.match(posts[0].message, /Provider unavailable/);
});

test("AcornOps route webhook formats issue lifecycle events with issue details", async () => {
  const posts = [];
  const commandContextStore = createInMemoryCommandContextStore();
  const routeToken = "route-token";
  const signingSecret = "webhook-secret";
  commandContextStore.upsertWebhookRoute("user-1", {
    channelId: "channel-1",
    routeTokenHash: hashSecret(routeToken),
    subscriptions: [
      {
        workspaceId: "workspace-1",
        webhookId: "webhook-1",
        eventTypes: ["issue.resolved.v1"],
        signingSecret
      }
    ]
  });
  const body = {
    id: "event-issue-1",
    type: "issue.resolved.v1",
    workspaceId: "workspace-1",
    targetId: "target-1",
    subject: { type: "issue", id: "issue-1" },
    occurredAt: "2026-07-10T01:10:00.000Z",
    data: {
      previousStatus: "recovering",
      status: "resolved",
      lifecycleVersion: 3,
      issueType: "kubernetes_pod_unhealthy",
      severity: "critical",
      title: "Payments pod crash looping",
      summary: "Latest snapshot reports pod payments-abc in namespace payments as CrashLoopBackOff. Restart count: 6. Restart count: 6.",
      scopeKind: "namespace",
      scopeName: "payments",
      objectKind: "pod",
      objectName: "payments-abc",
      reason: "CrashLoopBackOff",
      firstSeenAt: "2026-07-10T00:00:00.000Z",
      lastSeenAt: "2026-07-10T00:30:00.000Z",
      resolvedAt: "2026-07-10T01:10:00.000Z",
      occurrenceCount: 5,
      reopenedCount: 1,
      stateAsOf: "2026-07-10T01:10:00.000Z"
    }
  };

  const result = await handleAcornOpsRouteWebhook({
    routeToken,
    ...signedWebhookInput(body, signingSecret),
    commandContextStore,
    mattermostClient: fakeMattermostClient(posts)
  });

  assert.equal(result.status, 202);
  assert.equal(posts.length, 1);
  assert.match(posts[0].message, /🚨 \*\*AcornOps issue alert: Resolved\*\*/);
  assert.match(posts[0].message, /\*\*Payments pod crash looping\*\*/);
  assert.match(posts[0].message, /Severity: \*\*CRITICAL\*\*/);
  assert.match(posts[0].message, /Summary: Latest snapshot reports pod payments-abc in namespace payments as CrashLoopBackOff\. Restart count: 6\./);
  assert.doesNotMatch(posts[0].message, /Restart count: 6\. Restart count: 6\./);
  assert.match(posts[0].message, /Resolved: 2026-07-10 09:10:00 SGT/);
  assert.match(posts[0].message, /Last seen: 2026-07-10 08:30:00 SGT/);
  assert.doesNotMatch(posts[0].message, /Workspace:/);
  assert.doesNotMatch(posts[0].message, /Target:/);
  assert.doesNotMatch(posts[0].message, /Issue:/);
});

test("AcornOps route webhook formats generic events with createdAt timestamp fallback and configured timezone", async () => {
  const posts = [];
  const commandContextStore = createInMemoryCommandContextStore();
  const routeToken = "route-token";
  const signingSecret = "webhook-secret";
  commandContextStore.upsertWebhookRoute("user-1", {
    channelId: "channel-1",
    routeTokenHash: hashSecret(routeToken),
    subscriptions: [
      {
        workspaceId: "workspace-1",
        webhookId: "webhook-1",
        eventTypes: ["agent.disconnected.v1"],
        signingSecret
      }
    ]
  });
  const body = {
    id: "event-agent-1",
    type: "agent.disconnected.v1",
    createdAt: "2026-07-10T02:00:00.000Z",
    workspaceId: "workspace-1",
    subject: { type: "agent", id: "agent-1" },
    data: {
      title: "Agent disconnected"
    }
  };

  const result = await handleAcornOpsRouteWebhook({
    routeToken,
    ...signedWebhookInput(body, signingSecret),
    commandContextStore,
    mattermostClient: fakeMattermostClient(posts),
    alertTimeZone: "America/New_York"
  });

  assert.equal(result.status, 202);
  assert.match(posts[0].message, /AcornOps info alert/);
  assert.match(posts[0].message, /\*\*Agent disconnected\*\*/);
  assert.match(posts[0].message, /Occurred: 2026-07-09 22:00:00 GMT-4/);
  assert.doesNotMatch(posts[0].message, /Workspace:/);
  assert.doesNotMatch(posts[0].message, /Target:/);
  assert.doesNotMatch(posts[0].message, /Subject:/);
});

test("AcornOps route webhook rejects stale or invalid signatures", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.upsertWebhookRoute("user-1", {
    channelId: "channel-1",
    routeTokenHash: hashSecret("route-token"),
    subscriptions: [
      {
        workspaceId: "workspace-1",
        webhookId: "webhook-1",
        signingSecret: "webhook-secret"
      }
    ]
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
    subscriptions: [
      {
        workspaceId: "workspace-1",
        webhookId: "webhook-1",
        signingSecret: "webhook-secret"
      }
    ]
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
  if (body.type) {
    headers["acornops-event-type"] = body.type;
  }
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
