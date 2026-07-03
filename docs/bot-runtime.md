# Bot Runtime

This note records the bot runtime scaffold decision and the commands a future session should use.

## Decision

Use Node.js with ECMAScript modules and built-in runtime APIs for the first Mattermost bot-account process.

The first scaffold intentionally avoided Express, Fastify, TypeScript, queues, or third-party Mattermost clients. The current bot still uses Node.js built-in HTTP/WebSocket/runtime APIs, with Postgres support for durable bot state when `BOT_DATABASE_URL` is configured.

## Local Commands

Install project dependencies:

```sh
npm install
```

Run tests:

```sh
npm test
```

Run lint checks:

```sh
npm run lint
```

Run the build check:

```sh
npm run build
```

Run all bot verification:

```sh
npm run verify:bot
```

Run the local bot process:

```sh
npm start
```

The bot automatically loads `.env` from the repository root before reading environment variables. A local `.env` file is ignored by Git and should contain:

```env
MATTERMOST_URL=http://localhost:8065
MATTERMOST_BOT_TOKEN=replace-with-bot-token
MATTERMOST_BOT_USERNAME=acorn-ops-bot

ACORNOPS_API_BASE_URL=http://localhost:8081
EXTERNAL_INTEGRATION_SERVICE_TOKEN=replace-with-acornops-external-integration-token

BOT_DATABASE_URL=postgres://user:password@localhost:5432/acornops_mattermost_bot
BOT_HTTP_HOST=0.0.0.0
BOT_HTTP_PORT=8080
BOT_PUBLIC_BASE_URL=https://mattermost-bot.example.com
MATTERMOST_ACTION_SECRET=replace-with-action-secret
ACORNOPS_WEBHOOK_SECRET=replace-with-webhook-secret
```

Optional chat timing controls:

```env
CHAT_RUN_POLL_ATTEMPTS=15
CHAT_RUN_POLL_INTERVAL_MS=1000
RUN_STREAM_RECONNECT_ATTEMPTS=3
RUN_STREAM_RECONNECT_DELAY_MS=1000
RUN_STREAM_FALLBACK_POLL_INTERVAL_MS=3000
RUN_STREAM_FALLBACK_POLL_MAX_MS=180000
```

## Container Image

Build the production image:

```sh
docker build -t acornops-mattermost-bot:local .
```

Verify the image build:

```sh
./scripts/verify-docker.sh
```

Run the image with environment injected at startup:

```sh
docker run --rm --env-file .env acornops-mattermost-bot:local
```

Run with Docker Compose:

```sh
docker compose up --build
```

`docker-compose.yml` defaults `MATTERMOST_URL` to `http://host.docker.internal:8065` and `ACORNOPS_API_BASE_URL` to `http://host.docker.internal:8081` so a container can reach Mattermost and AcornOps services running on the host through Docker Desktop. Provide `MATTERMOST_BOT_TOKEN` and `EXTERNAL_INTEGRATION_SERVICE_TOKEN` through your local `.env` file or shell environment.

The Dockerfile installs dependencies inside the image from `package*.json`; host `node_modules` is ignored. The verification stage runs `npm run verify:bot`, and the runtime stage copies only `package*.json` and `src/`. The image runs as the non-root `node` user and exposes the optional inbound bot HTTP port. The listener only binds when `BOT_HTTP_PORT` is non-zero.

## Current Behavior

- The bot authenticates to Mattermost as a bot account using `MATTERMOST_BOT_TOKEN`.
- The bot opens Mattermost's WebSocket endpoint and authenticates after connecting.
- The bot responds to direct messages and channel posts that mention `@acorn-ops-bot`.
- The bot username defaults to `acorn-ops-bot`, and can be changed in one place at runtime with `MATTERMOST_BOT_USERNAME`.
- Normal command responses are posted as main channel or direct-message posts. Chat replies are posted into the Mattermost thread registered for that AcornOps chat.
- The bot ignores messages authored by itself.
- Commands require a leading `!` on the command word only, for example `!clusters` and `!chat new`. Slash-prefixed commands return guidance to use `!`; unprefixed main messages nudge users toward `!help`.
- `!login` in a direct message calls AcornOps `POST /api/v1/auth/external-integrations/link` with `externalUserId` set to the Mattermost user id read from the post author and `externalDisplayName` set from the Mattermost sender name when available.
- `!login` in a shared channel does not call AcornOps; it asks the user to direct-message `@acorn-ops-bot`.
- `!status` calls AcornOps `POST /api/v1/auth/external-integrations/resolve` with the same external user id.
- `!workspaces` calls AcornOps `GET /api/v1/workspaces?limit=50` with the external integration service token and `x-acornops-external-user-id` set to the observed Mattermost post author id. It returns numbered text and, when `BOT_PUBLIC_BASE_URL` is configured, Mattermost buttons for the first practical set of workspaces.
- Workspace results are numbered. `!workspaces 1` calls AcornOps `GET /api/v1/workspaces/{workspaceId}` for the remembered workspace id and shows details without changing the user's current workspace.
- `!workspace 1` calls AcornOps `GET /api/v1/workspaces/{workspaceId}` for the remembered workspace id, shows details, and updates the user's current workspace.
- `!workspace` shows details for the user's current workspace selection.
- `!targets` calls AcornOps `GET /api/v1/workspaces/{workspaceId}/targets?limit=50` for the current workspace.
- `!target 1` fetches `GET /api/v1/workspaces/{workspaceId}/targets/{targetId}` and updates the current generic target.
- `!clusters`/`!cluster 1` and `!vms`/`!vm 1` remain compatibility shortcuts over Kubernetes- and VM-specific endpoints.
- `!resources` and `!findings` list resources or findings for the currently selected target. They accept documented `key=value` filters where the AcornOps endpoint supports them.
- `!investigations` lists snapshot-derived investigations for the current workspace.
- `!help` shows only the common workflow. `!help filters` shows supported filters and finite values. The full reference lives in `docs/wiki-mattermost-bot-commands.md`.
- `!chat new [title]` creates a read-only troubleshooting session for the selected target, posts a short acknowledgement, then posts a Mattermost root thread such as `Chat #1 - Investigate Pods`. Replies inside that registered thread are posted to AcornOps as read-only assistant questions without requiring `!`.
- If a chat answer is still running after the brief immediate polling window, the bot follows the run with AcornOps SSE and posts the final assistant answer back to the same Mattermost channel when it completes.
- `!chat end` is valid inside a registered chat thread and closes only that chat. `!chat pause` and `!chat resume` are retired from the main UX because the main bot conversation stays available while chat threads remain open. `!ask <question>`, `!sessions`, `!session`, and `!messages` remain compatibility commands but are not part of the short help surface.
- `!webhook connect`, `!webhook status`, and `!webhook disconnect` manage the current Mattermost user's user-level AcornOps alert route.
- Only `!login` is direct-message-only. Authenticated read, read-only assistant, and user webhook routing commands can run in direct messages or channel mentions.
- The bot does not keep bot-side login state or AcornOps browser sessions. It keeps only lightweight ids, names, thread mappings, active-run references, webhook routes, and inbound event ids for command convenience.
- `MATTERMOST_URL` defaults to `http://localhost:8065`, and `ACORNOPS_API_BASE_URL` defaults to `http://localhost:8081`, the standalone AcornOps control-plane URL.

## Message Flow

1. `src/bot/index.js` loads `.env`, then asks `src/bot/config.js` for Mattermost, AcornOps, chat timing, database, and inbound HTTP configuration.
2. `src/bot/mattermost-client.js` uses the shared JSON request helper in `src/bot/http-client.js` and verifies the token with `GET /api/v4/users/me`.
3. `src/bot/state/postgres-store.js` creates an in-memory store for tests/dev or loads/migrates Postgres state when `BOT_DATABASE_URL` is configured.
4. `src/bot/server.js` starts the optional built-in HTTP listener for health checks, Mattermost actions, and AcornOps webhooks when `BOT_HTTP_PORT` is non-zero.
5. `src/bot/runner.js` opens `/api/v4/websocket` and authenticates the WebSocket connection.
6. Mattermost emits `posted` events for new messages the bot can see.
7. `src/bot/runner.js` extracts the Mattermost user id from the Mattermost post author and ignores bot-authored posts.
8. If the post is a reply with a `root_id` matching a registered chat thread for that channel, the runner routes it as a thread-chat message even when the bot is not mentioned.
9. Otherwise `src/bot/message.js` accepts direct messages and channel posts that mention the configured bot username, then rejects slash-prefixed input and requires a `!` command word.
10. `!login` direct messages ask AcornOps to create a short-lived account link and return the `linkUrl` exactly as AcornOps sent it.
11. `!status` asks AcornOps whether the Mattermost identity is durably linked.
12. `!workspaces` asks AcornOps for the current user's workspace page, formats numbered workspace rows, stores lightweight workspace references, and optionally attaches Mattermost workspace-selection buttons.
13. `!workspace 1` selects current workspace and clears current target/session state.
14. `!targets` uses the current workspace and updates numbered generic target references; `!clusters` and `!vms` remain shortcuts.
15. `!target 1`, `!cluster 1`, and `!vm 1` select exactly one current target and clear the previous target plus current session state.
16. `!chat new [title]` creates a read-only troubleshooting session for the selected target. A target chosen through `!target 1` uses `POST /api/v1/workspaces/{workspaceId}/targets/{targetId}/sessions`; a Kubernetes cluster chosen through the compatibility `!cluster 1` command uses the Kubernetes-cluster session endpoint.
17. The runner posts the chat acknowledgement, creates the Mattermost root-thread post, and stores the returned `root_id` keyed by `channel_id + root_id`.
18. Replies in the registered thread post session messages with `toolAccessMode: "read_only"` and stable `clientMessageId` values derived from the Mattermost source post id when available.
19. After posting a chat message, the bot polls the read-only run briefly, fetches session messages when the run completes, and renders the newest assistant reply for that run. The default response window is 15 poll attempts with a 1000 ms interval, configured by `CHAT_RUN_POLL_ATTEMPTS` and `CHAT_RUN_POLL_INTERVAL_MS`.
20. If the run is still active after the response window, the bot records one active streamed run for that chat thread, returns a short acknowledgement in the thread, and starts `src/bot/chat/follower.js` in the background.
21. The run follower opens `GET /api/v1/runs/{runId}/stream` with `Authorization: Bearer EXTERNAL_INTEGRATION_SERVICE_TOKEN`, `x-acornops-external-user-id`, and `Accept: text/event-stream`. `run_completed` loads the newest assistant message for that run and posts it to Mattermost with the chat thread `root_id`. `run_failed` and `run_cancelled` post concise terminal messages.
22. If SSE disconnects before a terminal state, the follower checks `GET /api/v1/runs/{runId}`, reconnects up to 3 times, then falls back to bounded polling. The reconnect and fallback defaults are controlled by `RUN_STREAM_RECONNECT_ATTEMPTS`, `RUN_STREAM_RECONNECT_DELAY_MS`, `RUN_STREAM_FALLBACK_POLL_INTERVAL_MS`, and `RUN_STREAM_FALLBACK_POLL_MAX_MS`.
23. `src/bot/mattermost-client.js` posts responses with `POST /api/v4/posts`, including `root_id`, `props`, and attachment/action payloads when provided.

## Command Context

Current workspace, target, session, thread, and webhook route state are Mattermost chat conveniences, not AcornOps concepts.

The store is keyed primarily by external user id. With `BOT_DATABASE_URL`, `src/bot/state/postgres-store.js` persists the same shape in Postgres and loads it at startup. Without `BOT_DATABASE_URL`, the bot uses the in-memory implementation for tests and simple local development.

The store keeps:

- the most recent workspace list as `{ id, name }` references for numbered commands;
- the current workspace as `{ id, name }`;
- the most recent generic target list and current generic target as `{ id, name, type, source }`, where `source` distinguishes generic target selections from compatibility cluster/VM selections for session routing;
- the most recent cluster list and current cluster as `{ id, name }`;
- the most recent VM list and current VM as `{ id, name }`;
- the most recent session list and current session as `{ id, name }`;
- the latest run id/status/session reference;
- chat-thread records keyed by Mattermost `channel_id + root_id`, including creator, session, title, number, and closed state;
- active streamed run pointers keyed by chat thread;
- user-level AcornOps webhook alert routes;
- inbound webhook event ids for idempotency.

Only one target can be selected at a time. Selecting a workspace clears the current target, cluster, VM, session, and latest run. Selecting a target, cluster, or VM clears the previous target-specific session and latest run. Each chat thread follows at most one active streamed run; one user can keep multiple chat threads open at the same time.

Postgres persistence makes command context, chat-thread lookup, webhook routes, active run records, and inbound event ids restart-resilient. Active SSE network followers are still process-local while running; on restart the active run record remains available for future recovery work, but no resume worker is implemented yet.

## Inbound HTTP

The bot can run one built-in HTTP listener:

- `GET /healthz` returns basic readiness.
- `POST /mattermost/actions` handles interactive Mattermost button callbacks. Workspace selection verifies the action secret and acting Mattermost user before updating that user's current workspace and returning an ephemeral confirmation.
- `POST /acornops/webhooks` handles signed AcornOps webhook deliveries. The handler verifies `AcornOps-Timestamp` and `AcornOps-Signature`, rejects stale timestamps, deduplicates `AcornOps-Event-Id`, resolves the user-level route, and posts a concise alert to Mattermost.

Mattermost and AcornOps must be able to reach `BOT_PUBLIC_BASE_URL` for interactive actions and webhooks in any live environment.

## AcornOps Account-Link Stage

AcornOps owns browser OIDC, cookie-backed user sessions, Mattermost link tokens, and durable Mattermost-to-AcornOps links.

The bot does not collect passwords, does not ask users to paste session cookies into Mattermost, does not call the old `dev-login` endpoint for command login, does not build plain OIDC links, and does not poll transaction ids.

See `docs/acornops-chat-login-contract.md` and `docs/bot-auth-sessions.md`.

## Local Mattermost Account Target

- Bot username: `acorn-ops-bot`
- Display name: `AcornOps Bot`
- Token storage: local environment only; do not commit bot tokens.
- First verification path: send a direct message or channel mention to `@acorn-ops-bot` from a non-bot user and record the response evidence.

## Runtime Versions

- Node.js verified locally: `v25.8.1`
- npm verified locally: `11.11.0`
- Minimum Node.js declared in `package.json`: `>=22`
