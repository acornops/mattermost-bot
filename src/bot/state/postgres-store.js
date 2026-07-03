import { createInMemoryCommandContextStore } from "../commands/context.js";

export async function createCommandContextStore({
  databaseUrl = "",
  logger = console,
  pool = null
} = {}) {
  if (!databaseUrl && !pool) {
    return createInMemoryCommandContextStore();
  }

  const db = pool ?? await createPgPool(databaseUrl);
  await migrate(db);
  const initialState = await loadState(db);
  const memory = createInMemoryCommandContextStore({ initialState });
  return wrapPersistentStore({ memory, db, logger });
}

async function createPgPool(databaseUrl) {
  const { Pool } = await import("pg");
  return new Pool({
    connectionString: databaseUrl
  });
}

async function migrate(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS bot_user_contexts (
      external_user_id TEXT PRIMARY KEY,
      context JSONB NOT NULL,
      chat_counter INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS bot_chat_threads (
      channel_id TEXT NOT NULL,
      root_id TEXT NOT NULL,
      external_user_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      session_name TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      chat_number INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      active_run JSONB NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (channel_id, root_id)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS bot_webhook_routes (
      external_user_id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      root_id TEXT NOT NULL DEFAULT '',
      display_name TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS bot_inbound_events (
      event_id TEXT PRIMARY KEY,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function loadState(db) {
  const [contexts, threads, routes, events] = await Promise.all([
    db.query("SELECT external_user_id, context, chat_counter FROM bot_user_contexts"),
    db.query("SELECT * FROM bot_chat_threads"),
    db.query("SELECT * FROM bot_webhook_routes"),
    db.query("SELECT event_id FROM bot_inbound_events")
  ]);

  return {
    contexts: Object.fromEntries(
      contexts.rows.map((row) => [row.external_user_id, row.context])
    ),
    chatCounters: Object.fromEntries(
      contexts.rows.map((row) => [row.external_user_id, row.chat_counter])
    ),
    chatThreads: threads.rows.map((row) => ({
      externalUserId: row.external_user_id,
      channelId: row.channel_id,
      rootId: row.root_id,
      sessionId: row.session_id,
      sessionName: row.session_name,
      title: row.title,
      number: row.chat_number,
      status: row.status,
      activeRun: row.active_run
    })),
    webhookRoutes: routes.rows.map((row) => ({
      externalUserId: row.external_user_id,
      channelId: row.channel_id,
      rootId: row.root_id,
      displayName: row.display_name
    })),
    inboundEvents: events.rows.map((row) => row.event_id)
  };
}

function wrapPersistentStore({ memory, db, logger }) {
  const store = { ...memory };

  for (const method of contextMutationMethods) {
    store[method] = (...args) => {
      const result = memory[method](...args);
      persistContext(db, memory, args[0]).catch(logPersistenceError(logger));
      return result;
    };
  }

  store.nextChatNumber = (externalUserId) => {
    const result = memory.nextChatNumber(externalUserId);
    persistContext(db, memory, externalUserId, result).catch(logPersistenceError(logger));
    return result;
  };

  store.registerChatThread = (externalUserId, thread) => {
    const result = memory.registerChatThread(externalUserId, thread);
    persistThread(db, result).catch(logPersistenceError(logger));
    return result;
  };

  store.closeChatThread = (channelId, rootId, externalUserId = "") => {
    const result = memory.closeChatThread(channelId, rootId, externalUserId);
    if (result) {
      persistThread(db, result).catch(logPersistenceError(logger));
    }
    return result;
  };

  store.rememberActiveRunForChat = (channelId, rootId, run) => {
    const result = memory.rememberActiveRunForChat(channelId, rootId, run);
    if (result) {
      persistThread(db, result).catch(logPersistenceError(logger));
    }
    return result;
  };

  store.clearActiveRunForChat = (channelId, rootId, runId = "") => {
    const result = memory.clearActiveRunForChat(channelId, rootId, runId);
    if (result) {
      persistThread(db, result).catch(logPersistenceError(logger));
    }
    return result;
  };

  store.upsertWebhookRoute = (externalUserId, route) => {
    const result = memory.upsertWebhookRoute(externalUserId, route);
    persistWebhookRoute(db, result).catch(logPersistenceError(logger));
    return result;
  };

  store.deleteWebhookRoute = (externalUserId) => {
    const result = memory.deleteWebhookRoute(externalUserId);
    deleteWebhookRoute(db, externalUserId).catch(logPersistenceError(logger));
    return result;
  };

  store.rememberInboundEvent = async (eventId) => {
    if (!memory.rememberInboundEvent(eventId)) {
      return false;
    }

    const result = await db.query(
      "INSERT INTO bot_inbound_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING",
      [eventId]
    );
    return result.rowCount > 0;
  };

  store.close = async () => {
    if (typeof db.end === "function") {
      await db.end();
    }
  };

  return store;
}

const contextMutationMethods = [
  "rememberWorkspaces",
  "selectWorkspace",
  "rememberTargets",
  "selectTarget",
  "rememberClusters",
  "selectCluster",
  "rememberVirtualMachines",
  "selectVirtualMachine",
  "rememberSessions",
  "selectSession",
  "startChat",
  "pauseChat",
  "resumeChat",
  "endChat",
  "rememberLatestRun",
  "rememberActiveRun",
  "clearActiveRun"
];

async function persistContext(db, memory, externalUserId, chatCounter = null) {
  if (!externalUserId) {
    return;
  }

  const context = memory.get(externalUserId);
  const existing = await db.query(
    "SELECT chat_counter FROM bot_user_contexts WHERE external_user_id = $1",
    [externalUserId]
  );
  const nextCounter = chatCounter ?? existing.rows[0]?.chat_counter ?? 0;
  await db.query(
    `
      INSERT INTO bot_user_contexts (external_user_id, context, chat_counter, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (external_user_id) DO UPDATE SET
        context = EXCLUDED.context,
        chat_counter = GREATEST(bot_user_contexts.chat_counter, EXCLUDED.chat_counter),
        updated_at = NOW()
    `,
    [externalUserId, context, nextCounter]
  );
}

async function persistThread(db, thread) {
  await db.query(
    `
      INSERT INTO bot_chat_threads (
        channel_id,
        root_id,
        external_user_id,
        session_id,
        session_name,
        title,
        chat_number,
        status,
        active_run,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (channel_id, root_id) DO UPDATE SET
        external_user_id = EXCLUDED.external_user_id,
        session_id = EXCLUDED.session_id,
        session_name = EXCLUDED.session_name,
        title = EXCLUDED.title,
        chat_number = EXCLUDED.chat_number,
        status = EXCLUDED.status,
        active_run = EXCLUDED.active_run,
        updated_at = NOW()
    `,
    [
      thread.channelId,
      thread.rootId,
      thread.externalUserId,
      thread.sessionId,
      thread.sessionName,
      thread.title,
      thread.number,
      thread.status,
      thread.activeRun
    ]
  );
}

async function persistWebhookRoute(db, route) {
  await db.query(
    `
      INSERT INTO bot_webhook_routes (
        external_user_id,
        channel_id,
        root_id,
        display_name,
        updated_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (external_user_id) DO UPDATE SET
        channel_id = EXCLUDED.channel_id,
        root_id = EXCLUDED.root_id,
        display_name = EXCLUDED.display_name,
        updated_at = NOW()
    `,
    [route.externalUserId, route.channelId, route.rootId, route.displayName]
  );
}

async function deleteWebhookRoute(db, externalUserId) {
  await db.query("DELETE FROM bot_webhook_routes WHERE external_user_id = $1", [externalUserId]);
}

function logPersistenceError(logger) {
  return (error) => {
    logger.error(error instanceof Error ? error.message : error);
  };
}
