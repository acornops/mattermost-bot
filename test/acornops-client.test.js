import assert from "node:assert/strict";
import test from "node:test";
import { AcornOpsClient } from "../src/bot/acornops-client.js";

test("createMattermostLink posts the AcornOps Mattermost identity contract", async () => {
  const requests = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    chatServiceToken: "chat-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({
        linkUrl: "https://console.acornops.dev/integrations/mattermost/link?token=mmlink_123",
        expiresAt: "2026-06-09T00:10:00.000Z"
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  const response = await client.createMattermostLink(mattermostIdentity());

  assert.deepEqual(response, {
    linkUrl: "https://console.acornops.dev/integrations/mattermost/link?token=mmlink_123",
    expiresAt: "2026-06-09T00:10:00.000Z"
  });
  assert.equal(requests[0].url, "http://acornops/api/v1/auth/chat/integration/link");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.headers.authorization, "Bearer chat-token");
  assert.deepEqual(JSON.parse(requests[0].init.body), mattermostIdentity());
});

test("resolveMattermostLink asks AcornOps for durable link state", async () => {
  const requests = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    chatServiceToken: "chat-token",
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

  const response = await client.resolveMattermostLink(mattermostIdentity());

  assert.equal(response.status, "linked");
  assert.equal(response.user.id, "acorn-user-1");
  assert.equal(requests[0].url, "http://acornops/api/v1/auth/chat/integration/resolve");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.headers.authorization, "Bearer chat-token");
  assert.deepEqual(JSON.parse(requests[0].init.body), mattermostIdentity());
});

test("listWorkspaces uses service auth and external user header", async () => {
  const requests = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    chatServiceToken: "chat-token",
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

  const response = await client.listWorkspaces(mattermostIdentity());

  assert.equal(response.items[0].id, "workspace-1");
  assert.equal(response.nextCursor, "cursor-2");
  assert.equal(requests[0].url, "http://acornops/api/v1/workspaces?limit=50");
  assert.equal(requests[0].init.method, "GET");
  assert.equal(requests[0].init.body, undefined);
  assert.equal(requests[0].init.headers.authorization, "Bearer chat-token");
  assert.equal(requests[0].init.headers["x-acornops-external-user-id"], "mattermost-user-1");
});

test("Mattermost chat auth requires the service token", async () => {
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    }
  });

  await assert.rejects(
    client.createMattermostLink(mattermostIdentity()),
    /MATTERMOST_CHAT_SERVICE_TOKEN/
  );

  await assert.rejects(
    client.listWorkspaces(mattermostIdentity()),
    /MATTERMOST_CHAT_SERVICE_TOKEN/
  );
});

function mattermostIdentity() {
  return {
    mattermostUserId: "mattermost-user-1"
  };
}
