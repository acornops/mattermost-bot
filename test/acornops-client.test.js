import assert from "node:assert/strict";
import test from "node:test";
import { AcornOpsClient, mattermostDevLoginEmail } from "../src/bot/acornops-client.js";

test("mattermostDevLoginEmail creates a deterministic local email", () => {
  assert.equal(
    mattermostDevLoginEmail("Mattermost User:1"),
    "mattermost-mattermost-user-1@acorn-ops-bot.local"
  );
});

test("devLogin calls AcornOps dev-login and captures the session cookie", async () => {
  const calls = [];
  const client = new AcornOpsClient({
    baseUrl: "http://acornops",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return okResponse({
        user: {
          id: "user-1",
          email: "mattermost-user-1@acorn-ops-bot.local",
          displayName: "alice"
        },
        mode: "dev"
      }, "acornops_cp_session=session-1; Path=/; HttpOnly");
    }
  });

  const result = await client.devLogin({
    email: "mattermost-user-1@acorn-ops-bot.local",
    name: "alice"
  });

  assert.deepEqual(result, {
    user: {
      id: "user-1",
      email: "mattermost-user-1@acorn-ops-bot.local",
      displayName: "alice"
    },
    mode: "dev",
    sessionCookie: "acornops_cp_session=session-1"
  });
  assert.equal(calls[0].url, "http://acornops/api/v1/auth/dev-login");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    email: "mattermost-user-1@acorn-ops-bot.local",
    name: "alice"
  });
});

function okResponse(json, setCookie) {
  return {
    ok: true,
    headers: {
      get(name) {
        return name.toLowerCase() === "set-cookie" ? setCookie : "";
      }
    },
    async json() {
      return json;
    }
  };
}
