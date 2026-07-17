import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import http from "node:http";
import { DEFAULT_ALERT_TIME_ZONE } from "./config.js";

const MAX_BODY_BYTES = 1024 * 1024;
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
const ISSUE_EVENT_TYPES = new Set([
  "issue.created.v1",
  "issue.reopened.v1",
  "issue.resolved.v1"
]);

export function createBotHttpServer({
  host = "0.0.0.0",
  port = 0,
  mattermostActionSecret = "",
  alertTimeZone = DEFAULT_ALERT_TIME_ZONE,
  botPublicBaseUrl = "",
  acornOpsConsoleUrl = "",
  commandContextStore,
  mattermostClient,
  acornOpsClient = null,
  runFollowerRegistry = null,
  logger = console
}) {
  const server = http.createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url ?? "/", "http://localhost");
      if (req.method === "GET" && pathname === "/healthz") {
        sendJson(res, 200, { status: "ok" });
        return;
      }

      if (req.method === "POST" && pathname === "/mattermost/actions") {
        const rawBody = await readBody(req);
        const payload = parseJson(rawBody);
        let result;
        if (payload.callback_id === "acornops_approval_decision") {
          result = await handleApprovalDecisionSubmission({
            payload,
            mattermostActionSecret,
            mattermostClient,
            acornOpsClient
          });
        } else if (payload.context?.action === "request_approval_decision") {
          result = await handleApprovalDecisionRequest({
            payload,
            mattermostActionSecret,
            botPublicBaseUrl,
            mattermostClient
          });
        } else if (payload.context?.action === "run_issue_triage") {
          result = await handleIssueTriageAction({
            payload,
            mattermostActionSecret,
            commandContextStore,
            mattermostClient,
            acornOpsClient,
            acornOpsConsoleUrl,
            runFollowerRegistry
          });
        } else {
          result = handleMattermostAction({ payload, mattermostActionSecret, commandContextStore });
        }
        if (!result.suppressPost) {
          await postMattermostActionResponse({
            payload,
            result,
            mattermostClient
          }).catch((error) => {
            logger.error(error instanceof Error ? error.message : error);
          });
        }
        sendJson(res, result.status, result.body);
        return;
      }

      const routeToken = routeTokenFromPath(pathname);
      if (req.method === "POST" && routeToken) {
        const rawBody = await readBody(req);
        const result = await handleAcornOpsRouteWebhook({
          routeToken,
          rawBody,
          headers: req.headers,
          commandContextStore,
          mattermostClient,
          alertTimeZone,
          botPublicBaseUrl,
          mattermostActionSecret
        });
        sendJson(res, result.status, result.body);
        return;
      }

      sendJson(res, 404, { error: "not_found" });
    } catch (error) {
      logger.error(error instanceof Error ? error.message : error);
      sendJson(res, error.statusCode ?? 500, {
        error: error.statusCode ? "bad_request" : "internal_error"
      });
    }
  });

  return {
    server,
    start() {
      if (!port) {
        return Promise.resolve(null);
      }
      return new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          server.off("error", onError);
          logger.log(`AcornOps bot HTTP server listening on ${host}:${port}`);
          resolve(server);
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, host);
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}

export function handleMattermostAction({
  payload,
  mattermostActionSecret,
  commandContextStore
}) {
  const context = payload.context ?? {};
  if (mattermostActionSecret && context.secret !== mattermostActionSecret) {
    return actionFailure("This action is not authorized.");
  }

  const actingUserId = payload.user_id ?? payload.userId ?? "";
  if (!actingUserId || actingUserId !== context.externalUserId) {
    return actionFailure("Only the Mattermost user who requested this list can select from it.");
  }

  if (context.action === "select_workspace") {
    return handleWorkspaceAction({
      actingUserId,
      context,
      commandContextStore
    });
  }

  if (context.action === "select_target") {
    return handleTargetAction({
      actingUserId,
      context,
      commandContextStore
    });
  }

  return actionFailure("Unknown AcornOps action.");
}

export async function handleApprovalDecisionRequest({
  payload,
  mattermostActionSecret,
  botPublicBaseUrl,
  mattermostClient
}) {
  const context = payload.context ?? {};
  const actingUserId = payload.user_id ?? payload.userId ?? "";
  if (!mattermostActionSecret || context.secret !== mattermostActionSecret) {
    return actionError("This approval action is not authorized.");
  }
  if (!actingUserId || actingUserId !== context.externalUserId) {
    return actionError("Only the Mattermost user who started this run can decide its approval.");
  }
  if (context.channelId && payload.channel_id && context.channelId !== payload.channel_id) {
    return actionError("This approval action does not belong to this Mattermost conversation.");
  }
  if (!["approved", "rejected"].includes(context.decision)) {
    return actionError("This approval decision is invalid.");
  }
  if (!context.runId || !context.approvalId || !payload.trigger_id || !payload.post_id) {
    return actionError("This approval action is incomplete. Wait for a new approval request.");
  }
  if (!mattermostClient || !botPublicBaseUrl) {
    return actionError("Mattermost approval confirmation is not configured.");
  }

  const state = signApprovalDialogState({
    externalUserId: actingUserId,
    runId: context.runId,
    approvalId: context.approvalId,
    workspaceId: context.workspaceId ?? "",
    channelId: context.channelId ?? payload.channel_id ?? "",
    rootId: context.rootId ?? "",
    postId: payload.post_id,
    decision: context.decision,
    toolName: compactText(context.toolName || "write operation", 120),
    summary: compactText(context.summary, 500),
    expiresAt: compactText(context.expiresAt, 120)
  }, mattermostActionSecret);
  const decisionLabel = context.decision === "approved" ? "Approve" : "Reject";
  const callbackUrl = `${botPublicBaseUrl.replace(/\/+$/, "")}/mattermost/actions`;
  const details = [
    `${decisionLabel} **${compactText(context.toolName || "this write operation", 120)}**?`,
    compactText(context.summary, 500),
    context.expiresAt ? `Expires: ${compactText(context.expiresAt, 120)}` : "",
    "This decision is sent to AcornOps and cannot be changed."
  ].filter(Boolean).join("\n\n");

  try {
    await mattermostClient.openDialog({
      triggerId: payload.trigger_id,
      url: callbackUrl,
      dialog: {
        callback_id: "acornops_approval_decision",
        title: `${decisionLabel} AcornOps action`,
        introduction_text: details,
        elements: [],
        submit_label: decisionLabel,
        notify_on_cancel: false,
        state
      }
    });
    return {
      status: 200,
      body: {},
      suppressPost: true
    };
  } catch {
    return actionError("The confirmation dialog could not be opened. Try the approval action again.");
  }
}

export async function handleApprovalDecisionSubmission({
  payload,
  mattermostActionSecret,
  mattermostClient,
  acornOpsClient
}) {
  const state = verifyApprovalDialogState(payload.state, mattermostActionSecret);
  const actingUserId = payload.user_id ?? payload.userId ?? "";
  const channelId = payload.channel_id ?? payload.channelId ?? "";
  if (!state
    || !actingUserId
    || actingUserId !== state.externalUserId
    || (state.channelId && channelId && state.channelId !== channelId)) {
    return dialogError("This approval confirmation is invalid or belongs to another user.");
  }
  if (!acornOpsClient || !mattermostClient) {
    return dialogError("AcornOps approval decisions are not configured.");
  }

  try {
    const result = await acornOpsClient.decideRunApproval(
      { externalUserId: actingUserId },
      state.runId,
      state.approvalId,
      state.decision
    );
    const status = result?.status ?? result?.approval?.status ?? state.decision;
    await updateApprovalPost({
      mattermostClient,
      state,
      status
    });
    return {
      status: 200,
      body: {},
      suppressPost: true
    };
  } catch (error) {
    const settledStatus = settledApprovalStatus(error);
    if (settledStatus) {
      await updateApprovalPost({
        mattermostClient,
        state,
        status: settledStatus
      }).catch(() => {});
      return {
        status: 200,
        body: {},
        suppressPost: true
      };
    }
    return dialogError(approvalDecisionErrorMessage(error, state.decision));
  }
}

async function updateApprovalPost({ mattermostClient, state, status }) {
  const label = status === "approved"
    ? "Approved"
    : status === "rejected"
      ? "Rejected"
      : status === "expired"
        ? "Expired"
        : "Already decided";
  const lines = [
    `**Approval ${label.toLowerCase()}** for **${state.toolName || "write operation"}**.`,
    state.summary,
    label === "Approved"
      ? "AcornOps is continuing the run."
      : "The bot will keep watching for the run’s final status."
  ].filter(Boolean);
  await mattermostClient.updatePost({
    postId: state.postId,
    message: lines.join("\n"),
    props: {}
  });
}

function signApprovalDialogState(value, secret) {
  const encoded = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyApprovalDialogState(value, secret) {
  if (!value || !secret) {
    return null;
  }
  const [encoded, signature, extra] = String(value).split(".");
  if (!encoded || !signature || extra) {
    return null;
  }
  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  if (!safeEqual(signature, expected)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function settledApprovalStatus(error) {
  const details = apiErrorDetails(error);
  if (details.approvalStatus) {
    return details.approvalStatus;
  }
  if (details.code === "APPROVAL_EXPIRED") {
    return "expired";
  }
  if (details.code === "APPROVAL_ALREADY_DECIDED") {
    return "decided";
  }
  return "";
}

function approvalDecisionErrorMessage(error, decision) {
  const details = apiErrorDetails(error);
  if (details.status === 403) {
    return decision === "approved"
      ? "AcornOps no longer permits this approval. You may still reject the request."
      : "AcornOps did not permit this rejection.";
  }
  if (details.status === 404) {
    return "This approval is no longer available.";
  }
  return "AcornOps could not record this decision. Try again or review the request in AcornOps.";
}

function apiErrorDetails(error) {
  const message = error instanceof Error ? error.message : String(error);
  const statusMatch = /\bfailed with (\d{3}):\s*([\s\S]*)$/.exec(message);
  if (!statusMatch) {
    return {};
  }
  try {
    const body = JSON.parse(statusMatch[2]);
    return {
      status: Number(statusMatch[1]),
      code: body?.error?.code ?? "",
      approvalStatus: body?.approval?.status ?? ""
    };
  } catch {
    return { status: Number(statusMatch[1]) };
  }
}

function actionError(message) {
  return {
    status: 200,
    body: { error: { message } },
    suppressPost: true
  };
}

function dialogError(message) {
  return {
    status: 200,
    body: { error: message },
    suppressPost: true
  };
}

function handleWorkspaceAction({
  actingUserId,
  context,
  commandContextStore
}) {
  const stale = staleActionContext({ actingUserId, context, commandContextStore });
  if (stale) {
    return stale;
  }

  const workspace = context.workspace ?? {};
  if (!workspace.id) {
    return actionFailure("Workspace selection failed: missing workspace id.");
  }

  commandContextStore.selectWorkspace(actingUserId, workspace);
  return actionSuccess(`Workspace changed successfully: ${workspace.name || workspace.id}`);
}

function handleTargetAction({
  actingUserId,
  context,
  commandContextStore
}) {
  const stale = staleActionContext({ actingUserId, context, commandContextStore });
  if (stale) {
    return stale;
  }

  const target = context.target ?? {};
  if (!target.id) {
    return actionFailure("Target selection failed: missing target id.");
  }

  const workspace = context.workspace ?? {};
  const currentWorkspace = commandContextStore.get(actingUserId).currentWorkspace;
  if (workspace.id && currentWorkspace?.id && workspace.id !== currentWorkspace.id) {
    return actionFailure("Target selection failed: your current workspace has changed. Send `!targets` again.");
  }
  if (workspace.id && !currentWorkspace?.id) {
    return actionFailure("Target selection failed: choose a workspace first, then send `!targets` again.");
  }

  commandContextStore.selectTarget(actingUserId, target);
  return actionSuccess(`Target changed successfully: ${target.name || target.id}`);
}

function staleActionContext({ actingUserId, context, commandContextStore }) {
  if (!Object.hasOwn(context, "contextGeneration")) {
    return null;
  }
  const expected = Number.parseInt(context.contextGeneration, 10) || 0;
  const actual = commandContextStore.get(actingUserId).contextGeneration ?? 0;
  if (expected !== actual) {
    return actionFailure("Selection failed: your bot context changed. Send `!workspaces` or `!targets` again.");
  }
  return null;
}

function actionSuccess(message) {
  return {
    status: 200,
    body: {},
    message
  };
}

function actionFailure(message) {
  return {
    status: 200,
    body: {},
    message
  };
}

export async function postMattermostActionResponse({
  payload,
  result,
  mattermostClient
}) {
  const channelId = payload.channel_id ?? payload.channelId ?? "";
  if (!mattermostClient || !channelId || !result.message) {
    return;
  }

  await mattermostClient.createPost({
    channelId,
    message: result.message
  });
}

export async function handleAcornOpsRouteWebhook({
  routeToken,
  rawBody,
  headers,
  commandContextStore,
  mattermostClient,
  alertTimeZone = DEFAULT_ALERT_TIME_ZONE,
  botPublicBaseUrl = "",
  mattermostActionSecret = ""
}) {
  const routeTokenHash = hashSecret(routeToken);
  const route = commandContextStore.getWebhookRouteByTokenHash?.(routeTokenHash);
  const signingSecrets = webhookSigningSecrets(route);
  if (!route || signingSecrets.length === 0) {
    return {
      status: 404,
      body: { error: "webhook_route_not_found" }
    };
  }

  const timestamp = headerValue(headers, "acornops-timestamp");
  const signature = headerValue(headers, "acornops-signature").replace(/^v1=/, "");
  if (!validWebhookTimestamp(timestamp) || !signingSecrets.some((secret) => validSignature({ secret, timestamp, rawBody, signature }))) {
    return {
      status: 401,
      body: { error: "invalid_signature" }
    };
  }

  const payload = parseJson(rawBody);
  const eventType = headerValue(headers, "acornops-event-type");
  if (eventType && payload && typeof payload === "object" && !payload.type) {
    payload.type = eventType;
  }
  const eventId = headerValue(headers, "acornops-event-id") || payload.id || "";
  if (!eventId) {
    return {
      status: 400,
      body: { error: "missing_event_id" }
    };
  }

  const firstSeen = await commandContextStore.rememberInboundEvent?.(eventId);
  if (!firstSeen) {
    return {
      status: 202,
      body: { status: "duplicate" }
    };
  }

  await mattermostClient.createPost({
    channelId: route.channelId,
    rootId: route.rootId,
    message: formatWebhookAlert(payload, { receivedAt: new Date().toISOString(), alertTimeZone }),
    attachments: issueTriageAttachments(payload, {
      route,
      botPublicBaseUrl,
      mattermostActionSecret
    })
  });
  return {
    status: 202,
    body: { status: "posted" }
  };
}

export async function handleIssueTriageAction({
  payload,
  mattermostActionSecret,
  commandContextStore,
  mattermostClient,
  acornOpsClient,
  acornOpsConsoleUrl = "",
  runFollowerRegistry = null
}) {
  const context = payload.context ?? {};
  const actingUserId = payload.user_id ?? payload.userId ?? "";
  if (mattermostActionSecret && context.secret !== mattermostActionSecret) {
    return actionFailure("This action is not authorized.");
  }
  if (!actingUserId || actingUserId !== context.externalUserId) {
    return actionFailure("Only the Mattermost user who received this alert can run triage.");
  }
  if (!acornOpsClient) {
    return actionFailure("AcornOps triage is not configured.");
  }

  const identity = { externalUserId: actingUserId };
  const { workspaceId, targetId, issueId } = context;
  try {
    const [issuePage, cluster, activity] = await Promise.all([
      acornOpsClient.listTargetIssues(identity, workspaceId, targetId),
      acornOpsClient.getKubernetesCluster(identity, workspaceId, targetId),
      acornOpsClient.getTargetChatActivity(identity, workspaceId, targetId)
    ]);
    const issues = issuePage.items ?? issuePage.data ?? [];
    const issue = issues.find((item) => (item.id ?? item.issueId) === issueId);
    if (!issue) {
      return actionFailure("This issue is no longer available for triage.");
    }

    const existing = existingTargetChat(activity);
    if (existing?.sessionId) {
      const link = buildConsoleSessionUrl(acornOpsConsoleUrl, workspaceId, targetId, existing.sessionId);
      return actionSuccess(link
        ? `A recent AcornOps chat already exists for this cluster. Continue it here: ${link}`
        : "A recent AcornOps chat already exists for this cluster. Open the cluster chat in AcornOps to continue it.");
    }

    const session = await acornOpsClient.createKubernetesClusterSession(identity, workspaceId, targetId, {
      title: `Triage: ${issue.title || "Issue"}`
    });
    const sessionId = session.id ?? session.sessionId ?? "";
    const prompt = buildIssueTriagePrompt(issue, cluster);
    const accepted = await acornOpsClient.postSessionMessage(identity, sessionId, {
      content: prompt,
      clientMessageId: `mattermost-webhook-${context.eventId}`,
      toolAccessMode: "read_only"
    });
    const runId = accepted.run_id ?? accepted.runId ?? "";
    const messageId = accepted.message_id ?? accepted.messageId ?? "";
    const channelId = payload.channel_id ?? payload.channelId ?? "";
    const root = await mattermostClient.createPost({
      channelId,
      message: `**Triage started: ${issue.title || "AcornOps issue"}**`
    });
    commandContextStore.registerChatThread?.(actingUserId, {
      channelId,
      rootId: root.id,
      sessionId,
      sessionName: session.title ?? `Triage: ${issue.title || "Issue"}`,
      title: session.title ?? `Triage: ${issue.title || "Issue"}`,
      status: "open",
      kind: "chat",
      workspaceId,
      toolAccessMode: "read_only"
    });
    runFollowerRegistry?.start({ identity, sessionId, runId, messageId, workspaceId, channelId, rootId: root.id });
    return actionSuccess("Triage started in a new Mattermost thread.");
  } catch (error) {
    return actionFailure(`Triage could not be started: ${safeActionError(error)}`);
  }
}

function existingTargetChat(activity) {
  const entries = activity?.recentActivity ?? activity?.items ?? [];
  return entries.find((entry) => entry.sessionId ?? entry.session_id) ?? null;
}

function buildConsoleSessionUrl(baseUrl, workspaceId, targetId, sessionId) {
  if (!baseUrl) return "";
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/workspaces/${encodeURIComponent(workspaceId)}/kubernetes-clusters/${encodeURIComponent(targetId)}/chat?session=${encodeURIComponent(sessionId)}`;
}

function buildIssueTriagePrompt(issue, cluster) {
  const scope = issue.scopeName || issue.namespace || "cluster-wide";
  return `Triage "${issue.title}" on ${cluster.name}. Severity: ${issue.severity}. Status: ${issue.status}. Scope: ${scope}. Issue summary: ${issue.summary}`;
}

function safeActionError(error) {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/\s+/g, " ").slice(0, 300);
}

function issueTriageAttachments(payload, { route, botPublicBaseUrl, mattermostActionSecret }) {
  if (!botPublicBaseUrl || !["issue.created.v1", "issue.reopened.v1"].includes(payload.type)) return undefined;
  const workspaceId = payload.workspaceId ?? payload.data?.workspaceId ?? "";
  const targetId = payload.targetId ?? payload.data?.targetId ?? "";
  const issueId = payload.subject?.id ?? payload.issueId ?? payload.data?.issueId ?? payload.data?.id ?? "";
  if (!route.externalUserId || !workspaceId || !targetId || !issueId) return undefined;
  return [{
    text: "Investigate this issue with AcornOps",
    actions: [{
      id: "runIssueTriage",
      name: "Run Triage",
      type: "button",
      integration: {
        url: `${botPublicBaseUrl.replace(/\/$/, "")}/mattermost/actions`,
        context: {
          action: "run_issue_triage",
          secret: mattermostActionSecret,
          externalUserId: route.externalUserId,
          workspaceId,
          targetId,
          issueId,
          eventId: payload.id ?? ""
        }
      }
    }]
  }];
}

function webhookSigningSecrets(route) {
  if (!route) {
    return [];
  }
  const secrets = Array.isArray(route.subscriptions)
    ? route.subscriptions.map((subscription) => subscription.signingSecret).filter(Boolean)
    : [];
  if (route.signingSecret) {
    secrets.push(route.signingSecret);
  }
  return [...new Set(secrets)];
}

function formatWebhookAlert(payload, { receivedAt = new Date().toISOString(), alertTimeZone = DEFAULT_ALERT_TIME_ZONE } = {}) {
  const type = compactText(payload.type, 120) || "unknown";
  if (ISSUE_EVENT_TYPES.has(type)) {
    return formatIssueWebhookAlert(payload, { type, alertTimeZone });
  }

  return formatInfoWebhookAlert(payload, { receivedAt, type, alertTimeZone });
}

function formatIssueWebhookAlert(payload, { type, alertTimeZone }) {
  const data = objectValue(payload.data);
  const title = compactText(data.title, 240) || compactText(data.issueType, 120) || "Untitled issue";
  const severity = compactText(data.severity, 80) || "unknown";
  const status = compactText(data.status, 80) || "unknown";
  const summary = dedupeRepeatedSentences(compactText(data.summary, 1000));
  const action = issueEventAction(type);
  const lines = [
    `${issueEventEmoji(type)} **AcornOps issue alert: ${action}**`,
    `**${title}**`,
    `- Severity: **${severity.toUpperCase()}**`,
    `- Status: ${status}`
  ];

  if (summary) {
    lines.push(`- Summary: ${summary}`);
  }
  const primaryTimestamp = type === "issue.resolved.v1" ? data.resolvedAt : data.lastSeenAt;
  const primaryLabel = type === "issue.resolved.v1" ? "Resolved" : "Last seen";
  if (primaryTimestamp) {
    lines.push(`- ${primaryLabel}: ${formatTimestamp(primaryTimestamp, alertTimeZone)}`);
  }
  if (type === "issue.resolved.v1" && data.lastSeenAt) {
    lines.push(`- Last seen: ${formatTimestamp(data.lastSeenAt, alertTimeZone)}`);
  }
  if (data.firstSeenAt) {
    lines.push(`- First seen: ${formatTimestamp(data.firstSeenAt, alertTimeZone)}`);
  }
  addOptionalLine(lines, "Scope", formatNamedPair(data.scope, data.scopeKind, data.scopeName));
  addOptionalLine(lines, "Object", formatNamedPair(data.object, data.objectKind, data.objectName));
  addOptionalLine(lines, "Reason", compactText(data.reason, 255));

  return lines.join("\n");
}

function formatInfoWebhookAlert(payload, { receivedAt, type, alertTimeZone }) {
  const data = objectValue(payload.data);
  const title = compactText(payload.title ?? data.title, 160);
  const summary = dedupeRepeatedSentences(compactText(payload.summary ?? data.summary, 1000));
  const status = compactText(payload.status ?? data.status, 80);
  const lines = [
    "🔔 **AcornOps info alert**",
    `- Type: ${type}`
  ];

  addOptionalLine(lines, "Title", title && title !== type ? title : "");
  addOptionalLine(lines, "Summary", summary);
  addOptionalLine(lines, "Status", status);
  lines.push(`- Occurred: ${formatTimestamp(genericOccurredAt(payload, receivedAt), alertTimeZone)}`);
  const message = dedupeRepeatedSentences(compactText(payload.data?.message ?? payload.data?.errorMessage, 500));
  if (message && message !== title && message !== summary) {
    lines.push(`- Message: ${message}`);
  }

  return lines.join("\n");
}

function issueEventAction(type) {
  if (type === "issue.created.v1") {
    return "Created";
  }
  if (type === "issue.reopened.v1") {
    return "Reopened";
  }
  if (type === "issue.resolved.v1") {
    return "Resolved";
  }
  return "Updated";
}

function issueEventEmoji(type) {
  return type === "issue.resolved.v1" ? "✅" : "🚨";
}

function genericOccurredAt(payload, receivedAt) {
  const data = objectValue(payload.data);
  return (
    payload.occurredAt ??
    data.occurredAt ??
    payload.createdAt ??
    data.createdAt ??
    payload.timestamp ??
    data.timestamp ??
    receivedAt
  );
}

function formatNamedPair(value, kind, name) {
  if (value && typeof value === "object") {
    return [compactText(value.kind, 120), compactText(value.name ?? value.id, 255)].filter(Boolean).join(" ");
  }
  if (value) {
    return compactText(value, 255);
  }
  return [compactText(kind, 120), compactText(name, 255)].filter(Boolean).join(" ");
}

function addOptionalLine(lines, label, value) {
  if (value) {
    lines.push(`- ${label}: ${value}`);
  }
}

function compactText(value, limit) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return "";
  }
  return String(value).replace(/\s+/g, " ").trim().slice(0, limit);
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function formatTimestamp(value, alertTimeZone = DEFAULT_ALERT_TIME_ZONE) {
  const text = compactText(value, 120);
  if (!text) {
    return "";
  }
  const time = Date.parse(text);
  if (!Number.isFinite(time)) {
    return text;
  }
  try {
    const parts = new Intl.DateTimeFormat("en-SG", {
      timeZone: alertTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short"
    }).formatToParts(new Date(time));
    const valueFor = (type) => parts.find((part) => part.type === type)?.value ?? "";
    return `${valueFor("year")}-${valueFor("month")}-${valueFor("day")} ${valueFor("hour")}:${valueFor("minute")}:${valueFor("second")} ${valueFor("timeZoneName")}`.trim();
  } catch {
    return formatTimestamp(value, DEFAULT_ALERT_TIME_ZONE);
  }
}

function dedupeRepeatedSentences(text) {
  if (!text) {
    return "";
  }
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
  if (!sentences) {
    return text;
  }
  const deduped = [];
  for (const sentence of sentences) {
    const normalized = sentence.replace(/\s+/g, " ").trim().toLowerCase();
    const previous = deduped.at(-1)?.replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized && normalized !== previous) {
      deduped.push(sentence.trim());
    }
  }
  return deduped.join(" ");
}

function validWebhookTimestamp(timestamp) {
  const value = Number.parseInt(timestamp, 10);
  if (!Number.isInteger(value)) {
    return false;
  }
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - value);
  return ageSeconds <= WEBHOOK_TOLERANCE_SECONDS;
}

function validSignature({ secret, timestamp, rawBody, signature }) {
  if (!signature) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return safeEqual(signature, expected);
}

export function hashSecret(secret) {
  return createHash("sha256").update(secret).digest("hex");
}

export function routeTokenFromPath(pathname) {
  const prefix = "/acornops/webhooks/routes/";
  if (!pathname.startsWith(prefix)) {
    return "";
  }
  return decodeURIComponent(pathname.slice(prefix.length));
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function headerValue(headers, name) {
  const value = headers[name] ?? "";
  return Array.isArray(value) ? value[0] ?? "" : String(value);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.byteLength;
    if (size > MAX_BODY_BYTES) {
      throw new Error("Request body too large.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseJson(rawBody) {
  try {
    return JSON.parse(rawBody || "{}");
  } catch {
    const error = new Error("Invalid JSON body.");
    error.statusCode = 400;
    throw error;
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json"
  });
  res.end(JSON.stringify(body));
}
