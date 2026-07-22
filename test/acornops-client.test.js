import assert from "node:assert/strict";
import test from "node:test";
import { AcornOpsClient, parseServerSentEvents } from "../src/bot/acornops-client.js";

test("createExternalIntegrationLink posts the AcornOps external integration identity contract", async () => {
  const requests = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    externalIntegrationToken: "chat-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({
        linkUrl: "https://console.acornops.dev/integrations/external/link?token=intlink_123",
        expiresAt: "2026-06-09T00:10:00.000Z"
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  const response = await client.createExternalIntegrationLink(linkIdentity());

  assert.deepEqual(response, {
    linkUrl: "https://console.acornops.dev/integrations/external/link?token=intlink_123",
    expiresAt: "2026-06-09T00:10:00.000Z"
  });
  assert.equal(requests[0].url, "http://acornops/api/v1/auth/external-integrations/link");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.headers.authorization, "Bearer chat-token");
  assert.deepEqual(JSON.parse(requests[0].init.body), linkIdentity());
});

test("resolveExternalIntegrationLink asks AcornOps for durable link state", async () => {
  const requests = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    externalIntegrationToken: "chat-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({
        status: "linked",
        user: {
          id: "acorn-user-1",
          email: "alice@example.com",
          displayName: "Alice"
        }
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  const response = await client.resolveExternalIntegrationLink(externalIdentity());

  assert.equal(response.status, "linked");
  assert.equal(response.user.id, "acorn-user-1");
  assert.equal(requests[0].url, "http://acornops/api/v1/auth/external-integrations/resolve");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.headers.authorization, "Bearer chat-token");
  assert.deepEqual(JSON.parse(requests[0].init.body), externalIdentity());
});

test("webhook route connect and status use external integration auth", async () => {
  const requests = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    externalIntegrationToken: "chat-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      const body = url.includes("/connect")
        ? {
            status: "connected",
            subscriptions: [
              {
                workspaceId: "workspace-1",
                workspaceName: "Platform",
                webhookId: "webhook-1",
                eventTypes: ["run.failed.v1"],
                signingSecret: "whsec_123",
                enabled: true
              }
            ]
          }
        : {
            status: "connected",
            subscriptions: [
              {
                workspaceId: "workspace-1",
                workspaceName: "Platform",
                webhookId: "webhook-1",
                eventTypes: ["run.failed.v1"],
                enabled: true
              }
            ]
          };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  const connect = await client.connectWebhookRoute(externalIdentity(), {
    deliveryUrl: "https://bot.example.com/acornops/webhooks/routes/token"
  });
  const status = await client.getWebhookRouteStatus(externalIdentity(), {
    deliveryUrl: "https://bot.example.com/acornops/webhooks/routes/token"
  });

  assert.equal(connect.subscriptions[0].signingSecret, "whsec_123");
  assert.equal(status.subscriptions[0].webhookId, "webhook-1");
  assert.equal(requests[0].url, "http://acornops/api/v1/external-integrations/webhook-routes/connect");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.headers.authorization, "Bearer chat-token");
  assert.equal(requests[0].init.headers["x-acornops-external-user-id"], "mattermost-user-1");
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    deliveryUrl: "https://bot.example.com/acornops/webhooks/routes/token"
  });
  assert.equal(
    requests[1].url,
    "http://acornops/api/v1/external-integrations/webhook-routes/status?deliveryUrl=https%3A%2F%2Fbot.example.com%2Facornops%2Fwebhooks%2Froutes%2Ftoken"
  );
  assert.equal(requests[1].init.method, "GET");
  assert.equal(requests[1].init.body, undefined);
  assert.equal(requests[1].init.headers.authorization, "Bearer chat-token");
  assert.equal(requests[1].init.headers["x-acornops-external-user-id"], "mattermost-user-1");
});

test("listWorkspaces uses service auth and external user header", async () => {
  const requests = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    externalIntegrationToken: "chat-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({
        items: [
          {
            id: "workspace-1",
            name: "Platform",
            plan: {
              key: "team",
              name: "Team"
            },
            quota: {
              members: { used: 0, limit: 10 },
              kubernetesClusters: { used: 0, limit: 3 },
              virtualMachines: { used: 0, limit: 5 }
            }
          }
        ],
        nextCursor: "cursor-2"
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  const response = await client.listWorkspaces(externalIdentity());

  assert.equal(response.items[0].id, "workspace-1");
  assert.equal(response.nextCursor, "cursor-2");
  assert.equal(requests[0].url, "http://acornops/api/v1/workspaces?limit=50");
  assert.equal(requests[0].init.method, "GET");
  assert.equal(requests[0].init.body, undefined);
  assert.equal(requests[0].init.headers.authorization, "Bearer chat-token");
  assert.equal(requests[0].init.headers["x-acornops-external-user-id"], "mattermost-user-1");
});

test("getWorkspace uses service auth and external user header", async () => {
  const requests = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    externalIntegrationToken: "chat-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({
        id: "workspace-1",
        name: "Platform"
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  const response = await client.getWorkspace(externalIdentity(), "workspace-1");

  assert.equal(response.id, "workspace-1");
  assert.equal(requests[0].url, "http://acornops/api/v1/workspaces/workspace-1");
  assert.equal(requests[0].init.method, "GET");
  assert.equal(requests[0].init.body, undefined);
  assert.equal(requests[0].init.headers.authorization, "Bearer chat-token");
  assert.equal(requests[0].init.headers["x-acornops-external-user-id"], "mattermost-user-1");
});

test("listKubernetesClusters uses workspace path query and external user header", async () => {
  const requests = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    externalIntegrationToken: "chat-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({
        items: [
          {
            id: "cluster-1",
            name: "Prod",
            status: "ready"
          }
        ]
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  const response = await client.listKubernetesClusters(externalIdentity(), "workspace-1", {
    q: "prod",
    status: "ready",
    agentState: "connected"
  });

  assert.equal(response.items[0].id, "cluster-1");
  assert.equal(
    requests[0].url,
    "http://acornops/api/v1/workspaces/workspace-1/kubernetes-clusters?limit=50&q=prod&status=ready&agentState=connected"
  );
  assert.equal(requests[0].init.method, "GET");
  assert.equal(requests[0].init.body, undefined);
  assert.equal(requests[0].init.headers.authorization, "Bearer chat-token");
  assert.equal(requests[0].init.headers["x-acornops-external-user-id"], "mattermost-user-1");
});

test("allowed external bot read endpoints use service auth and external user header", async () => {
  const requests = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    externalIntegrationToken: "chat-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  await client.getKubernetesCluster(externalIdentity(), "workspace-1", "cluster-1");
  await client.listKubernetesClusterResources(externalIdentity(), "workspace-1", "cluster-1", {
    namespace: "default"
  });
  await client.listWorkspaceIssues(externalIdentity(), "workspace-1", {
    q: "payments",
    status: "active",
    severity: "warning",
    targetId: "cluster-1",
    targetType: "kubernetes",
    namespace: "default"
  });
  await client.listTargets(externalIdentity(), "workspace-1", {
    q: "prod",
    targetType: "kubernetes"
  });
  await client.getTarget(externalIdentity(), "workspace-1", "target-1");
  await client.listVirtualMachines(externalIdentity(), "workspace-1", {
    status: "online"
  });
  await client.getVirtualMachine(externalIdentity(), "workspace-1", "vm-1");
  await client.listVirtualMachineResources(externalIdentity(), "workspace-1", "vm-1");

  assert.deepEqual(requests.map((request) => request.url), [
    "http://acornops/api/v1/workspaces/workspace-1/kubernetes-clusters/cluster-1",
    "http://acornops/api/v1/workspaces/workspace-1/kubernetes-clusters/cluster-1/resources?limit=100&namespace=default",
    "http://acornops/api/v1/workspaces/workspace-1/issues?limit=50&q=payments&status=active&severity=warning&targetId=cluster-1&targetType=kubernetes&namespace=default",
    "http://acornops/api/v1/workspaces/workspace-1/targets?limit=50&q=prod&targetType=kubernetes",
    "http://acornops/api/v1/workspaces/workspace-1/targets/target-1",
    "http://acornops/api/v1/workspaces/workspace-1/virtual-machines?limit=50&status=online",
    "http://acornops/api/v1/workspaces/workspace-1/virtual-machines/vm-1",
    "http://acornops/api/v1/workspaces/workspace-1/virtual-machines/vm-1/resources"
  ]);
  for (const request of requests) {
    assert.equal(request.init.headers.authorization, "Bearer chat-token");
    assert.equal(request.init.headers["x-acornops-external-user-id"], "mattermost-user-1");
  }
});

test("issue triage discovery uses target issues and chat activity endpoints", async () => {
  const requests = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops",
    externalIntegrationToken: "chat-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  await client.listTargetIssues(externalIdentity(), "workspace-1", "target-1");
  await client.getTargetChatActivity(externalIdentity(), "workspace-1", "target-1");

  assert.equal(requests[0].url, "http://acornops/api/v1/workspaces/workspace-1/targets/target-1/issues?limit=50");
  assert.equal(requests[1].url, "http://acornops/api/v1/workspaces/workspace-1/targets/target-1/chat-activity");
  assert.equal(requests[0].init.headers["x-acornops-external-user-id"], "mattermost-user-1");
});

test("assistant session endpoints post the requested run access mode", async () => {
  const requests = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    externalIntegrationToken: "chat-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({
        id: "session-1",
        message_id: "message-1",
        run_id: "run-1",
        items: []
      }), {
        status: init.method === "POST" ? 201 : 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  await client.createKubernetesClusterSession(externalIdentity(), "workspace-1", "cluster-1", {
    title: "Investigate Prod"
  });
  await client.createTargetSession(externalIdentity(), "workspace-1", "vm-1", {
    title: "Investigate VM"
  });
  await client.listKubernetesClusterSessions(externalIdentity(), "workspace-1", "cluster-1");
  await client.listTargetSessions(externalIdentity(), "workspace-1", "vm-1");
  await client.getSession(externalIdentity(), "session-1");
  await client.listSessionMessages(externalIdentity(), "session-1");
  await client.postSessionMessage(externalIdentity(), "session-1", {
    content: "Check health",
    clientMessageId: "message-key",
    toolAccessMode: "read_write"
  });
  await client.getRun(externalIdentity(), "run-1");
  await client.listRunEvents(externalIdentity(), "run-1");

  assert.deepEqual(requests.map((request) => request.url), [
    "http://acornops/api/v1/workspaces/workspace-1/kubernetes-clusters/cluster-1/sessions",
    "http://acornops/api/v1/workspaces/workspace-1/targets/vm-1/sessions",
    "http://acornops/api/v1/workspaces/workspace-1/kubernetes-clusters/cluster-1/sessions?limit=20",
    "http://acornops/api/v1/workspaces/workspace-1/targets/vm-1/sessions?limit=20",
    "http://acornops/api/v1/sessions/session-1",
    "http://acornops/api/v1/sessions/session-1/messages?limit=100",
    "http://acornops/api/v1/sessions/session-1/messages",
    "http://acornops/api/v1/runs/run-1",
    "http://acornops/api/v1/runs/run-1/events"
  ]);
  assert.deepEqual(JSON.parse(requests[6].init.body), {
    content: "Check health",
    toolAccessMode: "read_write",
    clientMessageId: "message-key"
  });
});

test("workflow endpoints list, create sessions, and launch messages with external auth", async () => {
  const requests = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    externalIntegrationToken: "chat-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({
        items: [],
        session: { id: "workflow-session-1" },
        run_id: "run-1"
      }), {
        status: init.method === "POST" ? 201 : 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  await client.listWorkflows(externalIdentity(), "workspace-1");
  await client.createWorkflowSession(externalIdentity(), "cluster-triage", {
    workspaceId: "workspace-1",
    approvedContextGrants: ["workspace_metadata", "target_inventory"]
  });
  await client.postWorkflowSessionMessage(externalIdentity(), "workflow-session-1", {
    content: "Triage @cluster[Development Cluster].",
    clientRequestId: "mm-post-1"
  });

  assert.deepEqual(requests.map((request) => request.url), [
    "http://acornops/api/v1/workspaces/workspace-1/workflows",
    "http://acornops/api/v1/workflows/cluster-triage/sessions",
    "http://acornops/api/v1/workflow-sessions/workflow-session-1/messages"
  ]);
  assert.deepEqual(JSON.parse(requests[1].init.body), {
    workspaceId: "workspace-1",
    approvedContextGrants: ["workspace_metadata", "target_inventory"]
  });
  assert.deepEqual(JSON.parse(requests[2].init.body), {
    content: "Triage @cluster[Development Cluster].",
    clientRequestId: "mm-post-1"
  });
  for (const request of requests) {
    assert.equal(request.init.headers.authorization, "Bearer chat-token");
    assert.equal(request.init.headers["x-acornops-external-user-id"], "mattermost-user-1");
  }
});

test("workflow messages require an idempotency key", async () => {
  const client = new AcornOpsClient({
    baseUrl: "http://acornops",
    serviceToken: "service-token",
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    }
  });

  await assert.rejects(
    client.postWorkflowSessionMessage(externalIdentity(), "workflow-session-1", {
      content: "Triage the cluster."
    }),
    /clientRequestId is required/
  );
});

test("parseServerSentEvents parses event/data pairs and heartbeat comments", async () => {
  const chunks = [
    ": heartbeat\n\n",
    "event: run_started\n",
    "data: {\"status\":\"running\"}\n\n",
    "event: run_completed\n",
    "data: {\"status\":\"completed\"}\n\n"
  ];

  const events = [];
  for await (const event of parseServerSentEvents(chunks)) {
    events.push(event);
  }

  assert.deepEqual(events, [
    {
      event: "run_started",
      data: {
        status: "running"
      }
    },
    {
      event: "run_completed",
      data: {
        status: "completed"
      }
    }
  ]);
});

test("parseServerSentEvents handles multiple events in byte chunks", async () => {
  const encoder = new TextEncoder();
  const chunks = [
    encoder.encode("event: run_failed\ndata: {\"code\":\"oops\"}\n\nevent: run_cancelled\n"),
    encoder.encode("data: plain text\n\n")
  ];

  const events = [];
  for await (const event of parseServerSentEvents(chunks)) {
    events.push(event);
  }

  assert.deepEqual(events, [
    {
      event: "run_failed",
      data: {
        code: "oops"
      }
    },
    {
      event: "run_cancelled",
      data: "plain text"
    }
  ]);
});

test("streamRun uses SSE endpoint and headers", async () => {
  const requests = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    externalIntegrationToken: "chat-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response("event: run_completed\ndata: {\"status\":\"completed\"}\n\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" }
      });
    }
  });

  const events = [];
  for await (const event of await client.streamRun(externalIdentity(), "run-1")) {
    events.push(event);
  }

  assert.equal(requests[0].url, "http://acornops/api/v1/runs/run-1/stream");
  assert.equal(requests[0].init.method, "GET");
  assert.equal(requests[0].init.headers.authorization, "Bearer chat-token");
  assert.equal(requests[0].init.headers["x-acornops-external-user-id"], "mattermost-user-1");
  assert.equal(requests[0].init.headers.accept, "text/event-stream");
  assert.deepEqual(events, [
    {
      event: "run_completed",
      data: {
        status: "completed"
      }
    }
  ]);
});

test("workflow execution observation replays from an SSE event id", async () => {
  const requests = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    externalIntegrationToken: "chat-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      if (url.endsWith("/stream?after=41")) {
        return new Response(
          "event: workflow_execution\nid: 42\ndata: {\"id\":\"42\",\"type\":\"execution_status_changed\",\"payload\":{\"status\":\"completed\"}}\n\n",
          { status: 200, headers: { "content-type": "text/event-stream" } }
        );
      }
      return new Response(JSON.stringify({
        execution: { id: "execution-1", status: "running" },
        attempts: []
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  await client.getWorkflowExecution(externalIdentity(), "execution-1");
  const events = [];
  for await (const event of await client.streamWorkflowExecution(
    externalIdentity(),
    "execution-1",
    { after: "41" }
  )) {
    events.push(event);
  }

  assert.equal(requests[0].url, "http://acornops/api/v1/workflow-executions/execution-1");
  assert.equal(
    requests[1].url,
    "http://acornops/api/v1/workflow-executions/execution-1/stream?after=41"
  );
  assert.equal(requests[1].init.headers["last-event-id"], "41");
  assert.deepEqual(events, [{
    event: "workflow_execution",
    id: "42",
    data: {
      id: "42",
      type: "execution_status_changed",
      payload: { status: "completed" }
    }
  }]);
});

test("approval decisions use the run-scoped external integration endpoint", async () => {
  const requests = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    externalIntegrationToken: "chat-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ status: "approved" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  await client.decideRunApproval(
    externalIdentity(),
    "run-1",
    "approval-1",
    "approved"
  );

  assert.equal(
    requests[0].url,
    "http://acornops/api/v1/runs/run-1/approvals/approval-1/decision"
  );
  assert.deepEqual(JSON.parse(requests[0].init.body), { decision: "approved" });
  assert.equal(requests[0].init.headers["x-acornops-external-user-id"], "mattermost-user-1");
});

test("external integration auth requires the service token", async () => {
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    }
  });

  await assert.rejects(
    client.createExternalIntegrationLink(externalIdentity()),
    /EXTERNAL_INTEGRATION_SERVICE_TOKEN/
  );

  await assert.rejects(
    client.listWorkspaces(externalIdentity()),
    /EXTERNAL_INTEGRATION_SERVICE_TOKEN/
  );

  await assert.rejects(
    client.getWorkspace(externalIdentity(), "workspace-1"),
    /EXTERNAL_INTEGRATION_SERVICE_TOKEN/
  );

  await assert.rejects(
    client.listKubernetesClusters(externalIdentity(), "workspace-1"),
    /EXTERNAL_INTEGRATION_SERVICE_TOKEN/
  );
});

function externalIdentity() {
  return {
    externalUserId: "mattermost-user-1"
  };
}

function linkIdentity() {
  return {
    ...externalIdentity(),
    externalDisplayName: "Alice"
  };
}
