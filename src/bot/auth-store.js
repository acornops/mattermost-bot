export function createMemoryAuthStore() {
  const sessions = new Map();

  return {
    set(mattermostUserId, session) {
      sessions.set(mattermostUserId, session);
    },

    get(mattermostUserId) {
      return sessions.get(mattermostUserId) ?? null;
    }
  };
}
