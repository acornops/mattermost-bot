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
  await client.listKubernetesClusterFindings(externalIdentity(), "workspace-1", "cluster-1", {
    severity: "warning"
  });
  await client.listWorkspaceInvestigations(externalIdentity(), "workspace-1", {
    clusterId: "cluster-1"
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
  await client.listVirtualMachineFindings(externalIdentity(), "workspace-1", "vm-1");

  assert.deepEqual(requests.map((request) => request.url), [
    "http://acornops/api/v1/workspaces/workspace-1/kubernetes-clusters/cluster-1",
    "http://acornops/api/v1/workspaces/workspace-1/kubernetes-clusters/cluster-1/resources?limit=100&namespace=default",
    "http://acornops/api/v1/workspaces/workspace-1/kubernetes-clusters/cluster-1/findings?limit=50&severity=warning",
    "http://acornops/api/v1/workspaces/workspace-1/investigations?limit=50&clusterId=cluster-1",
    "http://acornops/api/v1/workspaces/workspace-1/targets?limit=50&q=prod&targetType=kubernetes",
    "http://acornops/api/v1/workspaces/workspace-1/targets/target-1",
    "http://acornops/api/v1/workspaces/workspace-1/virtual-machines?limit=50&status=online",
    "http://acornops/api/v1/workspaces/workspace-1/virtual-machines/vm-1",
    "http://acornops/api/v1/workspaces/workspace-1/virtual-machines/vm-1/resources",
    "http://acornops/api/v1/workspaces/workspace-1/virtual-machines/vm-1/findings"
  ]);
  for (const request of requests) {
    assert.equal(request.init.headers.authorization, "Bearer chat-token");
    assert.equal(request.init.headers["x-acornops-external-user-id"], "mattermost-user-1");
  }
});

test("assistant session endpoints always post read-only runs", async () => {
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
    clientMessageId: "message-key"
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
    toolAccessMode: "read_only",
    clientMessageId: "message-key"
  });
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
