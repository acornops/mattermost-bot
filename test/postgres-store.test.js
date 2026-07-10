import assert from "node:assert/strict";
import test from "node:test";
import { createCommandContextStore } from "../src/bot/state/postgres-store.js";

test("Postgres command context store migrates, loads, and persists state", async () => {
  const queries = [];
  const pool = {
    async query(sql, params = []) {
      queries.push({ sql: String(sql), params });
      if (String(sql).includes("SELECT external_user_id, context, chat_counter")) {
        return {
          rows: [
            {
              external_user_id: "user-1",
              context: {
                workspaces: [],
                currentWorkspace: { id: "workspace-1", name: "Platform" }
              },
              chat_counter: 3
            }
          ]
        };
      }
      if (String(sql).includes("SELECT * FROM bot_chat_threads")) {
        return {
          rows: [
            {
              external_user_id: "user-1",
              channel_id: "channel-1",
              root_id: "root-1",
              session_id: "session-1",
              session_name: "Investigate Prod",
              title: "Investigate Prod",
              chat_number: 2,
              status: "open",
              thread_kind: "workflow",
              workflow_id: "cluster-triage",
              workspace_id: "workspace-1",
              tool_access_mode: "read_write",
              workflow_inputs: { clusterId: "cluster-1" },
              active_run: null
            }
          ]
        };
      }
      if (String(sql).includes("SELECT * FROM bot_webhook_routes")) {
        return {
          rows: [
            {
              provider: "acornops",
              external_user_id: "user-1",
              channel_id: "channel-1",
              root_id: "",
              display_name: "alice",
              route_token_hash: "token-hash",
              signing_secret: "",
              delivery_url: "https://bot.example.com/acornops/webhooks/routes/token",
              connection_status: "connected",
              connected_at: "2026-07-07T00:00:00.000Z",
              last_synced_at: "2026-07-07T00:00:00.000Z",
              last_error: "",
              subscription_snapshot: [
                {
                  workspaceId: "workspace-1",
                  workspaceName: "Platform",
                  webhookId: "webhook-1",
                  eventTypes: ["run.failed.v1"],
                  signingSecret: "secret"
                }
              ]
            }
          ]
        };
      }
      if (String(sql).includes("SELECT event_id FROM bot_inbound_events")) {
        return { rows: [{ event_id: "event-1" }] };
      }
      if (String(sql).includes("SELECT chat_counter FROM bot_user_contexts")) {
        return { rows: [{ chat_counter: 3 }] };
      }
      if (String(sql).includes("INSERT INTO bot_inbound_events")) {
        return { rowCount: params[0] === "event-2" ? 1 : 0, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    },
    async end() {}
  };

  const store = await createCommandContextStore({ pool, logger: quietLogger() });

  assert.deepEqual(store.get("user-1").currentWorkspace, {
    id: "workspace-1",
    name: "Platform"
  });
  assert.equal(store.getChatThread("channel-1", "root-1").sessionId, "session-1");
  assert.equal(store.getChatThread("channel-1", "root-1").kind, "workflow");
  assert.equal(store.getChatThread("channel-1", "root-1").toolAccessMode, "read_write");
  assert.deepEqual(store.getChatThread("channel-1", "root-1").workflowInputs, {
    clusterId: "cluster-1"
  });
  assert.equal(store.getWebhookRoute("user-1").channelId, "channel-1");
  assert.equal(store.getWebhookRoute("user-1").subscriptions[0].webhookId, "webhook-1");
  assert.equal(store.getWebhookRouteByTokenHash("token-hash").externalUserId, "user-1");
  assert.equal(store.nextChatNumber("user-1"), 4);
  store.selectWorkspace("user-1", { id: "workspace-2", name: "Sandbox" });
  store.connectWebhookRoute("user-1", {
    channelId: "channel-2",
    routeTokenHash: "token-hash-2",
    deliveryUrl: "https://bot.example.com/acornops/webhooks/routes/token-2",
    subscriptions: [
      {
        workspaceId: "workspace-2",
        workspaceName: "Sandbox",
        webhookId: "webhook-2",
        eventTypes: ["run.cancelled.v1"],
        signingSecret: "secret-2"
      }
    ]
  });
  store.rememberAccountFingerprint("user-1", "fingerprint-1");
  store.resetAccountContext("user-1");
  assert.equal(await store.rememberInboundEvent("event-2"), true);

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(queries.some((query) => query.sql.includes("CREATE TABLE IF NOT EXISTS bot_user_contexts")), true);
  assert.equal(queries.some((query) => query.sql.includes("ADD COLUMN IF NOT EXISTS route_token_hash")), true);
  assert.equal(queries.some((query) => query.sql.includes("ADD COLUMN IF NOT EXISTS thread_kind")), true);
  assert.equal(queries.some((query) => query.sql.includes("INSERT INTO bot_user_contexts")), true);
  assert.equal(queries.some((query) => query.sql.includes("INSERT INTO bot_webhook_routes")), true);
  assert.equal(queries.some((query) => query.sql.includes("INSERT INTO bot_inbound_events")), true);
  assert.equal(queries.some((query) => query.sql.includes("DELETE FROM bot_chat_threads WHERE external_user_id = $1")), true);
  assert.equal(store.get("user-1").currentWorkspace, null);
  assert.equal(store.get("user-1").accountFingerprint, "fingerprint-1");
  assert.equal(store.getWebhookRoute("user-1").channelId, "channel-2");
});

function quietLogger() {
  return {
    error() {}
  };
}
