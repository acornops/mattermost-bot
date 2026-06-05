import assert from "node:assert/strict";
import test from "node:test";
import { AcornOpsClient } from "../src/bot/acornops-client.js";

test("oidcLoginUrl builds the AcornOps OIDC browser login URL", () => {
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    }
  });

  assert.equal(
    client.oidcLoginUrl({ returnTo: "/api/v1/me" }),
    "http://acornops/api/v1/auth/oidc/login?return_to=%2Fapi%2Fv1%2Fme"
  );
});

test("startMattermostChatLogin posts a service-token protected transaction request", async () => {
  const requests = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    chatServiceToken: "chat-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({
        id: "chat-login-1",
        loginUrl: "http://acornops/api/v1/auth/oidc/login?chat_login_id=chat-login-1",
        expiresAt: "2026-06-05T00:10:00.000Z"
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  const response = await client.startMattermostChatLogin({
    mattermostUserId: "mattermost-user-1",
    mattermostUserName: "alice",
    returnTo: "/api/v1/auth/chat/mattermost/complete"
  });

  assert.deepEqual(response, {
    id: "chat-login-1",
    loginUrl: "http://acornops/api/v1/auth/oidc/login?chat_login_id=chat-login-1",
    expiresAt: "2026-06-05T00:10:00.000Z"
  });
  assert.equal(requests[0].url, "http://acornops/api/v1/auth/chat/mattermost/login");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.headers.authorization, "Bearer chat-token");
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    mattermostUserId: "mattermost-user-1",
    mattermostUserName: "alice",
    returnTo: "/api/v1/auth/chat/mattermost/complete"
  });
});

test("getMattermostChatLogin fetches a service-token protected transaction status", async () => {
  const requests = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops/",
    chatServiceToken: "chat-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({
        id: "chat-login-1",
        status: "completed",
        user: {
          id: "acorn-user-1",
          displayName: "Alice"
        },
        session: {
          token: "opaque-chat-session-token",
          expiresAt: "2026-06-05T01:00:00.000Z"
        }
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  const response = await client.getMattermostChatLogin("chat-login-1");

  assert.equal(response.status, "completed");
  assert.equal(response.user.id, "acorn-user-1");
  assert.equal(requests[0].url, "http://acornops/api/v1/auth/chat/mattermost/login/chat-login-1");
  assert.equal(requests[0].init.method, "GET");
  assert.equal(requests[0].init.headers.authorization, "Bearer chat-token");
});
