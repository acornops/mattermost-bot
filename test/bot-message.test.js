import assert from "node:assert/strict";
import test from "node:test";
import {
  handleBotMessage,
  normalizeBotText,
  shouldRespondToPost
} from "../src/bot/message.js";

test("normalizeBotText removes leading bot mention", () => {
  assert.equal(normalizeBotText("@acorn-ops-bot status", "acorn-ops-bot"), "status");
  assert.equal(normalizeBotText("@acorn-ops-bot: clusters", "acorn-ops-bot"), "clusters");
  assert.equal(normalizeBotText("status", "acorn-ops-bot"), "status");
});

test("shouldRespondToPost ignores bot-authored posts", () => {
  assert.equal(shouldRespondToPost({
    post: {
      user_id: "bot",
      message: "status"
    },
    botUserId: "bot",
    channelType: "D"
  }), false);
});

test("shouldRespondToPost accepts direct messages", () => {
  assert.equal(shouldRespondToPost({
    post: {
      user_id: "user-1",
      message: "status"
    },
    botUserId: "bot",
    channelType: "D"
  }), true);
});

test("shouldRespondToPost accepts mentions in channel posts", () => {
  assert.equal(shouldRespondToPost({
    post: {
      user_id: "user-1",
      message: "@acorn-ops-bot status"
    },
    botUserId: "bot",
    botUsername: "acorn-ops-bot",
    channelType: "O"
  }), true);
});

test("handleBotMessage returns identity-aware status placeholder", async () => {
  const response = await handleBotMessage({
    text: "@acorn-ops-bot status",
    userId: "user-1",
    userName: "alice"
  });

  assert.match(response, /AcornOps bot status:/);
  assert.match(response, /alice \(user-1\)/);
});

test("handleBotMessage returns help by default", async () => {
  assert.match(await handleBotMessage({ text: "" }), /AcornOps bot commands:/);
});

test("handleBotMessage starts AcornOps OIDC login for direct messages", async () => {
  const pendingLogins = new Map();
  const response = await handleBotMessage({
    text: "login",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    acornOpsLoginReturnTo: "/api/v1/me",
    authStore: {
      createPendingLogin(input) {
        assert.deepEqual(input, {
          mattermostUserId: "mattermost-user-1",
          mattermostUserName: "alice",
          loginUrl: "http://acornops/api/v1/auth/oidc/login?return_to=%2Fapi%2Fv1%2Fme",
          returnTo: "/api/v1/me"
        });
        const record = {
          id: "pending-1",
          ...input,
          createdAt: "2026-06-04T00:00:00.000Z",
          expiresAt: "2026-06-04T00:10:00.000Z"
        };
        pendingLogins.set(input.mattermostUserId, record);
        return record;
      }
    },
    acornOpsClient: {
      oidcLoginUrl(input) {
        assert.deepEqual(input, { returnTo: "/api/v1/me" });
        return "http://acornops/api/v1/auth/oidc/login?return_to=%2Fapi%2Fv1%2Fme";
      }
    }
  });

  assert.match(response, /AcornOps browser login link:/);
  assert.match(response, /http:\/\/acornops\/api\/v1\/auth\/oidc\/login/);
  assert.match(response, /No AcornOps password should be typed into Mattermost\./);
  assert.equal(pendingLogins.get("mattermost-user-1").id, "pending-1");
});

test("handleBotMessage starts backend Mattermost chat login when configured", async () => {
  const pendingLogins = new Map();
  const response = await handleBotMessage({
    text: "login",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    acornOpsLoginReturnTo: "/api/v1/auth/chat/mattermost/complete",
    authStore: {
      createPendingLogin(input) {
        assert.deepEqual(input, {
          id: "chat-login-1",
          mattermostUserId: "mattermost-user-1",
          mattermostUserName: "alice",
          loginUrl: "http://acornops/api/v1/auth/oidc/login?chat_login_id=chat-login-1",
          returnTo: "/api/v1/auth/chat/mattermost/complete",
          expiresAt: "2026-06-05T00:10:00.000Z"
        });
        const record = {
          ...input,
          createdAt: "2026-06-05T00:00:00.000Z"
        };
        pendingLogins.set(input.mattermostUserId, record);
        return record;
      }
    },
    acornOpsClient: {
      canStartMattermostChatLogin() {
        return true;
      },
      async startMattermostChatLogin(input) {
        assert.deepEqual(input, {
          mattermostUserId: "mattermost-user-1",
          mattermostUserName: "alice",
          returnTo: "/api/v1/auth/chat/mattermost/complete"
        });
        return {
          id: "chat-login-1",
          loginUrl: "http://acornops/api/v1/auth/oidc/login?chat_login_id=chat-login-1",
          expiresAt: "2026-06-05T00:10:00.000Z"
        };
      },
      oidcLoginUrl() {
        throw new Error("oidcLoginUrl should not be called when chat login is configured");
      }
    }
  });

  assert.match(response, /AcornOps chat login link:/);
  assert.match(response, /send `status` here/);
  assert.equal(pendingLogins.get("mattermost-user-1").id, "chat-login-1");
});

test("handleBotMessage falls back to plain OIDC when backend chat login is unavailable", async () => {
  const response = await handleBotMessage({
    text: "login",
    userId: "mattermost-user-1",
    userName: "alice",
    channelType: "D",
    acornOpsLoginReturnTo: "/api/v1/me",
    authStore: {
      createPendingLogin(input) {
        return {
          id: "pending-1",
          ...input,
          createdAt: "2026-06-05T00:00:00.000Z",
          expiresAt: "2026-06-05T00:10:00.000Z"
        };
      }
    },
    acornOpsClient: {
      canStartMattermostChatLogin() {
        return true;
      },
      async startMattermostChatLogin() {
        throw new Error("AcornOps API POST /api/v1/auth/chat/mattermost/login failed with 404: not found");
      },
      oidcLoginUrl(input) {
        assert.deepEqual(input, { returnTo: "/api/v1/me" });
        return "http://acornops/api/v1/auth/oidc/login?return_to=%2Fapi%2Fv1%2Fme";
      }
    }
  });

  assert.match(response, /AcornOps browser login link:/);
  assert.match(response, /Backend chat login API unavailable:/);
  assert.match(response, /chat\/mattermost\/login failed with 404/);
});

test("handleBotMessage keeps login direct-message only", async () => {
  const response = await handleBotMessage({
    text: "@acorn-ops-bot login",
    userId: "user-1",
    userName: "alice",
    channelType: "O",
    acornOpsClient: {
      oidcLoginUrl() {
        throw new Error("oidcLoginUrl should not be called");
      }
    }
  });

  assert.match(response, /direct message/);
});

test("handleBotMessage status reports pending OIDC login state", async () => {
  const response = await handleBotMessage({
    text: "status",
    userId: "mattermost-user-1",
    userName: "alice",
    authStore: {
      getSession() {
        return null;
      },
      getPendingLogin(userId) {
        assert.equal(userId, "mattermost-user-1");
        return {
          expiresAt: "2026-06-04T00:10:00.000Z"
        };
      }
    }
  });

  assert.match(response, /Backend authentication: OIDC login pending until 2026-06-04T00:10:00.000Z/);
});

test("handleBotMessage status completes a backend Mattermost chat login", async () => {
  const sessions = new Map();
  const response = await handleBotMessage({
    text: "status",
    userId: "mattermost-user-1",
    userName: "alice",
    authStore: {
      getSession(userId) {
        return sessions.get(userId) ?? null;
      },
      getPendingLogin(userId) {
        assert.equal(userId, "mattermost-user-1");
        return {
          id: "chat-login-1",
          expiresAt: "2026-06-05T00:10:00.000Z"
        };
      },
      completePendingLogin(userId, session) {
        sessions.set(userId, session);
        return session;
      }
    },
    acornOpsClient: {
      canStartMattermostChatLogin() {
        return true;
      },
      async getMattermostChatLogin(loginId) {
        assert.equal(loginId, "chat-login-1");
        return {
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
        };
      }
    }
  });

  assert.match(response, /Backend authentication: connected as Alice \(acorn-user-1\)/);
  assert.equal(sessions.get("mattermost-user-1").token, "opaque-chat-session-token");
});

test("handleBotMessage status reports stored AcornOps session", async () => {
  const response = await handleBotMessage({
    text: "status",
    userId: "mattermost-user-1",
    userName: "alice",
    authStore: {
      getSession(userId) {
        assert.equal(userId, "mattermost-user-1");
        return {
          user: {
            id: "acorn-user-1",
            displayName: "alice"
          }
        };
      }
    }
  });

  assert.match(response, /Backend authentication: connected as alice \(acorn-user-1\)/);
});
