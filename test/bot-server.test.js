import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createInMemoryCommandContextStore } from "../src/bot/commands/context.js";
import {
  createBotHttpServer,
  handleApprovalDecisionRequest,
  handleApprovalDecisionSubmission,
  handleAcornOpsRouteWebhook,
  handleIssueTriageAction,
  handleMattermostAction,
  handleMattermostActionPayload,
  hashSecret,
  postMattermostActionResponse,
  routeTokenFromPath
} from "../src/bot/server.js";
import {
  signMattermostActionContext,
  verifyMattermostActionContext
} from "../src/bot/mattermost-actions.js";

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
      context: signedActionContext({
        action: "select_workspace",
        externalUserId: "user-1",
        workspace: {
          id: "workspace-1",
          name: "Platform"
        }
      })
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
      context: signedActionContext({
        action: "select_target",
        externalUserId: "user-1",
        target: {
          id: "target-1",
          name: "Prod cluster",
          type: "kubernetes"
        }
      })
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
      context: signedActionContext({
        action: "select_workspace",
        externalUserId: "user-1"
      }, "wrong")
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
      context: signedActionContext({
        action: "select_target",
        externalUserId: "user-1",
        target: {
          id: "target-1"
        }
      })
    },
    mattermostActionSecret: "action-secret",
    commandContextStore: createInMemoryCommandContextStore()
  });
  const missingTarget = handleMattermostAction({
    payload: {
      user_id: "user-1",
      context: signedActionContext({
        action: "select_target",
        externalUserId: "user-1",
        target: {}
      })
    },
    mattermostActionSecret: "action-secret",
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
      context: signedActionContext({
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
      })
    },
    mattermostActionSecret: "action-secret",
    commandContextStore
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {});
  assert.match(result.message, /current workspace has changed/);
  assert.equal(commandContextStore.get("user-1").currentTarget, null);
});

test("Mattermost action rejects stale buttons after context reset", () => {
  const commandContextStore = createInMemoryCommandContextStore();
  commandContextStore.selectWorkspace("user-1", {
    id: "workspace-1",
    name: "Platform"
  });
  commandContextStore.resetAccountContext("user-1");

  const result = handleMattermostAction({
    payload: {
      user_id: "user-1",
      context: signedActionContext({
        action: "select_workspace",
        externalUserId: "user-1",
        contextGeneration: 0,
        workspace: {
          id: "workspace-1",
          name: "Platform"
        }
      })
    },
    mattermostActionSecret: "action-secret",
    commandContextStore
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {});
  assert.match(result.message, /context changed/);
  assert.equal(commandContextStore.get("user-1").currentWorkspace, null);
});

test("approval buttons open user-bound confirmation dialogs for approve and reject", async () => {
  const dialogs = [];
  for (const decision of ["approved", "rejected"]) {
    const result = await handleApprovalDecisionRequest({
      payload: approvalActionPayload(decision),
      mattermostActionSecret: "action-secret",
      botPublicBaseUrl: "https://bot.example.com/",
      mattermostClient: {
        async openDialog(dialog) {
          dialogs.push(dialog);
        }
      }
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {});
    assert.equal(result.suppressPost, true);
  }

  assert.equal(dialogs[0].url, "https://bot.example.com/mattermost/actions");
  assert.equal(dialogs[0].dialog.submit_label, "Approve");
  assert.equal(dialogs[1].dialog.submit_label, "Reject");
  assert.deepEqual(dialogs[0].dialog.elements, []);
  assert.notEqual(dialogs[0].dialog.state, dialogs[1].dialog.state);
});

test("Mattermost callback dispatch resolves the action from its signed token", async () => {
  const dialogs = [];
  const result = await handleMattermostActionPayload({
    payload: approvalActionPayload("approved"),
    mattermostActionSecret: "action-secret",
    botPublicBaseUrl: "https://bot.example.com",
    commandContextStore: createInMemoryCommandContextStore(),
    mattermostClient: {
      async openDialog(dialog) {
        dialogs.push(dialog);
      }
    }
  });

  assert.equal(result.suppressPost, true);
  assert.equal(dialogs[0].dialog.callback_id, "acornops_approval_decision");
});

test("approval button rejects wrong secrets and cross-user clicks", async () => {
  const wrongSecret = await handleApprovalDecisionRequest({
    payload: approvalActionPayload("approved", {}, "wrong"),
    mattermostActionSecret: "action-secret",
    botPublicBaseUrl: "https://bot.example.com",
    mattermostClient: { async openDialog() {} }
  });
  const wrongUserPayload = approvalActionPayload("approved");
  wrongUserPayload.user_id = "user-2";
  const wrongUser = await handleApprovalDecisionRequest({
    payload: wrongUserPayload,
    mattermostActionSecret: "action-secret",
    botPublicBaseUrl: "https://bot.example.com",
    mattermostClient: { async openDialog() {} }
  });
  const wrongChannelPayload = approvalActionPayload("approved");
  wrongChannelPayload.channel_id = "channel-2";
  const wrongChannel = await handleApprovalDecisionRequest({
    payload: wrongChannelPayload,
    mattermostActionSecret: "action-secret",
    botPublicBaseUrl: "https://bot.example.com",
    mattermostClient: { async openDialog() {} }
  });

  assert.match(wrongSecret.body.error.message, /not authorized/);
  assert.match(wrongUser.body.error.message, /started this run/);
  assert.match(wrongChannel.body.error.message, /does not belong/);
});

test("signed approval submission records the decision and removes buttons", async () => {
  const dialogs = [];
  const updates = [];
  const decisions = [];
  await handleApprovalDecisionRequest({
    payload: approvalActionPayload("approved"),
    mattermostActionSecret: "action-secret",
    botPublicBaseUrl: "https://bot.example.com",
    mattermostClient: {
      async openDialog(dialog) {
        dialogs.push(dialog);
      }
    }
  });
  const result = await handleApprovalDecisionSubmission({
    payload: {
      callback_id: "acornops_approval_decision",
      user_id: "user-1",
      channel_id: "channel-1",
      state: dialogs[0].dialog.state
    },
    mattermostActionSecret: "action-secret",
    mattermostClient: {
      async updatePost(post) {
        updates.push(post);
      }
    },
    acornOpsClient: {
      async decideRunApproval(identity, runId, approvalId, decision) {
        decisions.push({ identity, runId, approvalId, decision });
        return { status: "approved" };
      }
    }
  });

  assert.deepEqual(decisions, [{
    identity: { externalUserId: "user-1" },
    runId: "run-1",
    approvalId: "approval-1",
    decision: "approved"
  }]);
  assert.equal(result.suppressPost, true);
  assert.deepEqual(updates[0].props, {});
  assert.match(updates[0].message, /Approval approved/);
});

test("approval submission remains successful when only the Mattermost post update fails", async () => {
  const dialogs = [];
  const logs = [];
  let decisions = 0;
  await handleApprovalDecisionRequest({
    payload: approvalActionPayload("approved"),
    mattermostActionSecret: "action-secret",
    botPublicBaseUrl: "https://bot.example.com",
    mattermostClient: {
      async openDialog(dialog) {
        dialogs.push(dialog);
      }
    }
  });

  const result = await handleApprovalDecisionSubmission({
    payload: {
      callback_id: "acornops_approval_decision",
      user_id: "user-1",
      channel_id: "channel-1",
      state: dialogs[0].dialog.state
    },
    mattermostActionSecret: "action-secret",
    mattermostClient: {
      async updatePost() {
        throw new Error("Mattermost unavailable");
      }
    },
    acornOpsClient: {
      async decideRunApproval() {
        decisions += 1;
        return { status: "approved" };
      }
    },
    logger: {
      error(message) {
        logs.push(message);
      }
    },
    postUpdateAttempts: 2
  });

  assert.equal(decisions, 1);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {});
  assert.equal(result.suppressPost, true);
  assert.match(logs[0], /recorded approval approval-1 as approved/);
  assert.match(logs[0], /Mattermost unavailable/);
});

test("approval submission rejects tampering and handles settled or revoked decisions", async () => {
  const dialogs = [];
  await handleApprovalDecisionRequest({
    payload: approvalActionPayload("rejected"),
    mattermostActionSecret: "action-secret",
    botPublicBaseUrl: "https://bot.example.com",
    mattermostClient: {
      async openDialog(dialog) {
        dialogs.push(dialog);
      }
    }
  });
  const state = dialogs[0].dialog.state;
  const invalid = await handleApprovalDecisionSubmission({
    payload: { user_id: "user-2", channel_id: "channel-1", state },
    mattermostActionSecret: "action-secret",
    mattermostClient: {},
    acornOpsClient: {}
  });
  const updates = [];
  const expired = await handleApprovalDecisionSubmission({
    payload: { user_id: "user-1", channel_id: "channel-1", state },
    mattermostActionSecret: "action-secret",
    mattermostClient: {
      async updatePost(post) {
        updates.push(post);
      }
    },
    acornOpsClient: {
      async decideRunApproval() {
        throw new Error('AcornOps API POST failed with 409: {"error":{"code":"APPROVAL_EXPIRED"}}');
      }
    }
  });
  const revoked = await handleApprovalDecisionSubmission({
    payload: { user_id: "user-1", channel_id: "channel-1", state },
    mattermostActionSecret: "action-secret",
    mattermostClient: { async updatePost() {} },
    acornOpsClient: {
      async decideRunApproval() {
        throw new Error('AcornOps API POST failed with 403: {"error":{"code":"FORBIDDEN"}}');
      }
    }
  });

  assert.match(invalid.body.error, /another user/);
  assert.equal(expired.suppressPost, true);
  assert.match(updates[0].message, /Approval expired/);
  assert.match(revoked.body.error, /did not permit this rejection/);
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
  assert.match(posts[0].message, /🔔 \*\*AcornOps info alert\*\*/);
  assert.match(posts[0].message, /run.failed.v1/);
  assert.match(posts[0].message, /Provider unavailable/);
});

test("AcornOps route webhook releases its event reservation when Mattermost posting fails", async () => {
  const commandContextStore = createInMemoryCommandContextStore();
  const routeToken = "route-token";
  const signingSecret = "webhook-secret";
  commandContextStore.upsertWebhookRoute("user-1", {
    channelId: "channel-1",
    routeTokenHash: hashSecret(routeToken),
    subscriptions: [{ signingSecret }]
  });
  const input = {
    routeToken,
    ...signedWebhookInput({ id: "event-retry-1", type: "run.failed.v1" }, signingSecret),
    commandContextStore
  };

  await assert.rejects(
    handleAcornOpsRouteWebhook({
      ...input,
      mattermostClient: {
        async createPost() {
          throw new Error("Mattermost unavailable");
        }
      }
    }),
    /Mattermost unavailable/
  );

  const posts = [];
  const retry = await handleAcornOpsRouteWebhook({
    ...input,
    mattermostClient: fakeMattermostClient(posts)
  });

  assert.equal(retry.status, 202);
  assert.equal(retry.body.status, "posted");
  assert.equal(posts.length, 1);
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
  assert.match(posts[0].message, /✅ \*\*AcornOps issue alert: Resolved\*\*/);
  assert.match(posts[0].message, /\*\*Payments pod crash looping\*\*/);
  assert.match(posts[0].message, /Severity: \*\*CRITICAL\*\*/);
  assert.match(posts[0].message, /Summary: Latest snapshot reports pod payments-abc in namespace payments as CrashLoopBackOff\. Restart count: 6\./);
  assert.doesNotMatch(posts[0].message, /Restart count: 6\. Restart count: 6\./);
  assert.match(posts[0].message, /Resolved: 2026-07-10 09:10:00 SGT/);
  assert.match(posts[0].message, /Last seen: 2026-07-10 08:30:00 SGT/);
  assert.doesNotMatch(posts[0].message, /Workspace:/);
  assert.doesNotMatch(posts[0].message, /Target:/);
  assert.doesNotMatch(posts[0].message, /Issue:/);

  const createdBody = {
    ...body,
    id: "event-issue-2",
    type: "issue.created.v1",
    data: {
      ...body.data,
      status: "active",
      resolvedAt: null
    }
  };
  const createdResult = await handleAcornOpsRouteWebhook({
    routeToken,
    ...signedWebhookInput(createdBody, signingSecret),
    commandContextStore,
    mattermostClient: fakeMattermostClient(posts)
  });

  assert.equal(createdResult.status, 202);
  assert.match(posts[1].message, /🚨 \*\*AcornOps issue alert: Created\*\*/);
});

test("created and reopened issue alerts include a Run Triage action", async () => {
  const posts = [];
  const commandContextStore = createInMemoryCommandContextStore();
  const routeToken = "route-token";
  const signingSecret = "webhook-secret";
  commandContextStore.upsertWebhookRoute("user-1", {
    channelId: "channel-1",
    routeTokenHash: hashSecret(routeToken),
    subscriptions: [{ workspaceId: "workspace-1", webhookId: "webhook-1", signingSecret }]
  });
  const body = {
    id: "event-issue-1",
    type: "issue.reopened.v1",
    workspaceId: "workspace-1",
    targetId: "cluster-1",
    subject: { type: "issue", id: "issue-1" },
    data: { title: "Pod unhealthy", severity: "critical", status: "active" }
  };

  await handleAcornOpsRouteWebhook({
    routeToken,
    ...signedWebhookInput(body, signingSecret),
    commandContextStore,
    mattermostClient: fakeMattermostClient(posts),
    botPublicBaseUrl: "https://bot.example.com/",
    mattermostActionSecret: "action-secret"
  });

  assert.equal(posts[0].attachments[0].actions[0].name, "Run Triage");
  const actionContext = posts[0].attachments[0].actions[0].integration.context;
  assert.deepEqual(Object.keys(actionContext), ["token"]);
  assert.doesNotMatch(actionContext.token, /action-secret/);
  assert.deepEqual(verifyMattermostActionContext(actionContext.token, "action-secret"), {
    action: "run_issue_triage",
    externalUserId: "user-1",
    workspaceId: "workspace-1",
    targetId: "cluster-1",
    issueId: "issue-1",
    eventId: "event-issue-1",
    channelId: "channel-1"
  });
});

test("Run Triage rejects replay in a different Mattermost conversation", async () => {
  const payload = triageActionPayload();
  payload.channel_id = "channel-2";
  const result = await handleIssueTriageAction({
    payload,
    mattermostActionSecret: "action-secret",
    commandContextStore: createInMemoryCommandContextStore(),
    mattermostClient: fakeMattermostClient(),
    acornOpsClient: {}
  });

  assert.match(result.message, /does not belong to this Mattermost conversation/);
});

test("Run Triage links to a recent AcornOps cluster chat instead of creating another", async () => {
  let createCalls = 0;
  const result = await handleIssueTriageAction({
    payload: triageActionPayload(),
    mattermostActionSecret: "action-secret",
    commandContextStore: createInMemoryCommandContextStore(),
    mattermostClient: fakeMattermostClient(),
    acornOpsConsoleUrl: "https://console.example.com/",
    acornOpsClient: {
      async listTargetIssues() { return { items: [triageIssue()] }; },
      async getKubernetesCluster() { return { id: "cluster-1", name: "prod-cluster" }; },
      async getTargetChatActivity() { return { recentActivity: [{ sessionId: "session-existing" }] }; },
      async createKubernetesClusterSession() { createCalls += 1; }
    }
  });

  assert.equal(createCalls, 0);
  assert.match(result.message, /recent AcornOps chat already exists/);
  assert.match(result.message, /\/workspaces\/workspace-1\/kubernetes-clusters\/cluster-1\/chat\?session=session-existing/);
});

test("Run Triage creates a cluster session, sends the console prompt, and streams in a Mattermost thread", async () => {
  const posts = [];
  const starts = [];
  const commandContextStore = createInMemoryCommandContextStore();
  const result = await handleIssueTriageAction({
    payload: triageActionPayload(),
    mattermostActionSecret: "action-secret",
    commandContextStore,
    mattermostClient: fakeMattermostClient(posts),
    runFollowerRegistry: { start(input) { starts.push(input); return true; } },
    acornOpsClient: {
      async listTargetIssues() { return { items: [triageIssue()] }; },
      async getKubernetesCluster() { return { id: "cluster-1", name: "prod-cluster" }; },
      async getTargetChatActivity() { return { recentActivity: [] }; },
      async createKubernetesClusterSession(_identity, workspaceId, clusterId, body) {
        assert.equal(workspaceId, "workspace-1");
        assert.equal(clusterId, "cluster-1");
        assert.equal(body.title, "Triage: Pod unhealthy");
        return { id: "session-new", title: body.title };
      },
      async postSessionMessage(_identity, sessionId, body) {
        assert.equal(sessionId, "session-new");
        assert.equal(body.content, 'Triage "Pod unhealthy" on prod-cluster. Severity: critical. Status: active. Scope: payments. Issue summary: Pod is crash looping');
        assert.equal(body.toolAccessMode, "read_only");
        return { runId: "run-1", messageId: "message-1" };
      }
    }
  });

  assert.match(result.message, /new Mattermost thread/);
  assert.equal(posts[0].message, "**Triage started: Pod unhealthy**");
  const thread = commandContextStore.getChatThread("channel-1", "post-1");
  assert.equal(thread.sessionId, "session-new");
  assert.equal(starts[0].runId, "run-1");
  assert.equal(starts[0].rootId, "post-1");
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
      title: "Agent disconnected",
      summary: "The target agent stopped sending heartbeats.",
      status: "disconnected"
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
  assert.match(posts[0].message, /🔔 \*\*AcornOps info alert\*\*/);
  assert.match(posts[0].message, /Title: Agent disconnected/);
  assert.match(posts[0].message, /Summary: The target agent stopped sending heartbeats\./);
  assert.match(posts[0].message, /Status: disconnected/);
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

function triageActionPayload() {
  return {
    user_id: "user-1",
    channel_id: "channel-1",
    context: signedActionContext({
      action: "run_issue_triage",
      externalUserId: "user-1",
      workspaceId: "workspace-1",
      targetId: "cluster-1",
      issueId: "issue-1",
      eventId: "event-1",
      channelId: "channel-1"
    })
  };
}

function approvalActionPayload(decision, contextOverrides = {}, signingSecret = "action-secret") {
  return {
    user_id: "user-1",
    channel_id: "channel-1",
    trigger_id: "trigger-1",
    post_id: "approval-post-1",
    context: signedActionContext({
      action: "request_approval_decision",
      externalUserId: "user-1",
      runId: "run-1",
      approvalId: "approval-1",
      workspaceId: "workspace-1",
      channelId: "channel-1",
      rootId: "root-1",
      decision,
      toolName: "restart_workload",
      summary: "Restart payments-api",
      ...contextOverrides
    }, signingSecret)
  };
}

function signedActionContext(value, secret = "action-secret") {
  return {
    token: signMattermostActionContext(value, secret)
  };
}

function triageIssue() {
  return {
    id: "issue-1",
    title: "Pod unhealthy",
    severity: "critical",
    status: "active",
    scopeName: "payments",
    summary: "Pod is crash looping"
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
