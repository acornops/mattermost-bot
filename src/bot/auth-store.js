import { randomUUID } from "node:crypto";

const DEFAULT_PENDING_LOGIN_TTL_MS = 10 * 60 * 1000;

export function createMemoryAuthStore() {
  const sessions = new Map();
  const pendingLogins = new Map();
  const now = Date.now;

  return {
    setSession(mattermostUserId, session) {
      sessions.set(mattermostUserId, session);
    },

    getSession(mattermostUserId) {
      return sessions.get(mattermostUserId) ?? null;
    },

    set(mattermostUserId, session) {
      this.setSession(mattermostUserId, session);
    },

    get(mattermostUserId) {
      return this.getSession(mattermostUserId);
    },

    createPendingLogin({ id, mattermostUserId, mattermostUserName = "", loginUrl, returnTo = "", expiresAt }) {
      pruneExpiredPendingLogins(pendingLogins, now());
      const nowMs = now();
      const record = {
        id: id || randomUUID(),
        mattermostUserId,
        mattermostUserName,
        loginUrl,
        returnTo,
        createdAt: new Date(nowMs).toISOString(),
        expiresAt: expiresAt || new Date(nowMs + DEFAULT_PENDING_LOGIN_TTL_MS).toISOString()
      };
      pendingLogins.set(mattermostUserId, record);
      return record;
    },

    getPendingLogin(mattermostUserId) {
      pruneExpiredPendingLogins(pendingLogins, now());
      return pendingLogins.get(mattermostUserId) ?? null;
    },

    clearPendingLogin(mattermostUserId) {
      pendingLogins.delete(mattermostUserId);
    },

    completePendingLogin(mattermostUserId, session) {
      this.setSession(mattermostUserId, session);
      this.clearPendingLogin(mattermostUserId);
      return session;
    }
  };
}

function pruneExpiredPendingLogins(pendingLogins, nowMs) {
  for (const [mattermostUserId, record] of pendingLogins.entries()) {
    if (Date.parse(record.expiresAt) <= nowMs) {
      pendingLogins.delete(mattermostUserId);
    }
  }
}
