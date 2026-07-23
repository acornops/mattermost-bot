# Bot Runtime

This note records the bot runtime scaffold decision and the commands a future session should use.

## Decision

Use Node.js with ECMAScript modules and built-in runtime APIs for the first Mattermost bot-account process.

The first scaffold intentionally avoided Express, Fastify, TypeScript, queues, or third-party Mattermost clients. The current bot still uses Node.js built-in HTTP/WebSocket/runtime APIs, with Postgres support for durable bot state when `BOT_DATABASE_URL` is configured.

## Local Commands

For the complete seeded Mattermost + bot + Postgres development stack:

```sh
task doctor
task local-up
task local-smoke
```

Use `task local-down` to preserve local state, or `task local-reset` to remove the bot and Mattermost Compose volumes plus the ignored generated bot token. The seed is enabled by default and can be disabled with `SEED_MATTERMOST_DATA=false`. See `docs/local-environment.md` for credentials, ports, and the complete lifecycle.

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
BOT_ALERT_TIME_ZONE=Asia/Singapore
```

Optional chat timing controls:

```env
CHAT_RUN_POLL_ATTEMPTS=15
CHAT_RUN_POLL_INTERVAL_MS=1000
RUN_STREAM_RECONNECT_ATTEMPTS=3
RUN_STREAM_RECONNECT_DELAY_MS=1000
RUN_STREAM_FALLBACK_POLL_INTERVAL_MS=3000
RUN_STREAM_FALLBACK_POLL_MAX_MS=180000
WORKFLOW_FOLLOW_RETRY_DELAY_MS=3000
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

`docker-compose.yml` starts a bundled `bot-postgres` service for durable bot state. It defaults `BOT_DATABASE_URL` to that database, `MATTERMOST_URL` to `http://host.docker.internal:8065`, `ACORNOPS_API_BASE_URL` to `http://host.docker.internal:8081`, `BOT_PUBLIC_BASE_URL` to `http://host.docker.internal:8080`, and `BOT_ALERT_TIME_ZONE` to `Asia/Singapore` so Mattermost and AcornOps containers can reach the bot callback listener through Docker Desktop and alerts render in SGT by default. Provide `MATTERMOST_BOT_TOKEN` and `EXTERNAL_INTEGRATION_SERVICE_TOKEN` through your local `.env` file or shell environment.

The Dockerfile installs dependencies inside the image from `package*.json`; host `node_modules` is ignored. The verification stage runs `npm run verify:bot`, and the runtime stage copies only `package*.json` and `src/`. The image runs as the non-root `node` user and exposes the optional inbound bot HTTP port. The listener only binds when `BOT_HTTP_PORT` is non-zero.

## Current Behavior

- The bot authenticates to Mattermost as a bot account using `MATTERMOST_BOT_TOKEN`.
- The bot opens Mattermost's WebSocket endpoint and authenticates after connecting.
- The bot responds to direct messages and channel posts that mention `@acorn-ops-bot`.
- The bot username defaults to `acorn-ops-bot`, and can be changed in one place at runtime with `MATTERMOST_BOT_USERNAME`.
- Normal command responses are posted as main channel or direct-message posts. Chat and workflow replies are posted into their registered Mattermost threads.
- The bot ignores messages authored by itself.
- Commands require a leading `!` on the command word only, for example `!clusters` and `!chat new`. Slash-prefixed commands return guidance to use `!`; unprefixed main messages nudge users toward `!help`.
- `!login` in a direct message first calls AcornOps `POST /api/v1/auth/external-integrations/resolve` with `externalUserId` set to the Mattermost user id read from the post author. Already-linked users get a linked-account confirmation. Unlinked or expired users get an AcornOps account-link URL from `POST /api/v1/auth/external-integrations/link`; the bot preserves existing context and marks validation pending.
- `!login reset` clears the user's bot workspace, target, session, remembered-list, run, and chat/workflow thread context before returning a fresh account-link URL. It does not delete webhook routes.
- `!login` in a shared channel does not call AcornOps; it asks the user to direct-message `@acorn-ops-bot`.
- `!status` calls AcornOps `POST /api/v1/auth/external-integrations/resolve` with the same external user id.
- `!workspaces` calls AcornOps `GET /api/v1/workspaces?limit=50` with the external integration service token and `x-acornops-external-user-id` set to the observed Mattermost post author id. It returns numbered text and, when `BOT_PUBLIC_BASE_URL` is configured, Mattermost buttons for the first practical set of workspaces.
- Workspace results are numbered. `!workspaces 1` calls AcornOps `GET /api/v1/workspaces/{workspaceId}` for the remembered workspace id and shows details without changing the user's current workspace.
- `!workspace 1` calls AcornOps `GET /api/v1/workspaces/{workspaceId}` for the remembered workspace id, shows details, and updates the user's current workspace.
- `!workspace` shows details for the user's current workspace selection.
- `!targets` calls AcornOps `GET /api/v1/workspaces/{workspaceId}/targets?limit=50` for the current workspace. It returns numbered text and, when `BOT_PUBLIC_BASE_URL` is configured, Mattermost buttons for the first practical set of targets.
- `!target 1` fetches `GET /api/v1/workspaces/{workspaceId}/targets/{targetId}` and updates the current generic target.
- `!clusters`/`!cluster 1` and `!vms`/`!vm 1` remain compatibility shortcuts over Kubernetes- and VM-specific endpoints.
- `!resources` lists resources for the currently selected target. `!issues` calls the workspace-wide issues endpoint and accepts `q`, `status`, `severity`, `targetId`, `targetType`, and `namespace` filters.
- `!findings` and `!investigations` are removed commands and receive the same generic unknown-command response as any other unsupported command.
- `!workflows` lists every eligible active workflow returned by AcornOps and labels `capabilityPolicy` read-only/read-write mode plus possible approval requirements. `!workflow run <number|id> [key=value...]` validates declared string inputs, uses the exact `capabilityPolicy.contextGrants`, checks current `resourceRequirements`, renders inputs into launch content, and replaces the target prompt slot with the selected target's exact `@target[...]` reference.
- Every initial and follow-up workflow message includes a `clientRequestId` derived from the originating Mattermost post id. Retrying that same post reuses the value; a new reply gets a new value and execution. The id is not rendered in Mattermost.
- A successful launch creates a root post exactly like `**Workflow launched: Cluster triage**`. The bot follows the returned `executionId` through the replayable aggregate stream, resumes with `Last-Event-ID`, deduplicates replayed events, discovers every step run, and reads final workflow output from the latest attempt.
- Plain replies in a workflow thread post `content` and a new post-derived `clientRequestId` to the same workflow session and start a fresh execution. The session retains its pinned workflow version and approved context grants. The bot separately retains the launch target metadata and adds its exact `@target[...]` reference to each follow-up, so a later global target selection cannot redirect the thread. AcornOps resolves prompt-resource bindings for each message. Workflow and chat threads each allow one active execution and both close with `!chat end`.
- `!help` shows only the common workflow. `!help filters` shows supported filters and finite values; `!filters` is its compatibility alias. The full reference lives in `docs/wiki-mattermost-bot-commands.md`.
- `!chat new [title]` creates a read-only troubleshooting thread. `!chat new --write [title]` first refreshes the selected workspace and requires effective `permissions.create_read_write_runs`; accepted threads persist `toolAccessMode: "read_write"` and label the Mattermost root as read-write. AcornOps remains authoritative and may still reject a message with `403` if permissions changed.
- When a troubleshooting run or workflow execution requests approval, the follower shows the tool name, safe summary, expiry, and **Approve**/**Reject** buttons only when `BOT_PUBLIC_BASE_URL` and `MATTERMOST_ACTION_SECRET` are configured. Each button contains an expiring signed token but never the signing key. The callback verifies that token and the exact originating user, then opens a confirmation-only dialog with a separate short-lived signed state token. Submission verifies the state and user again before calling the run-scoped decision endpoint. Successful or settled decisions retry the bot-owned post update and remove its buttons; a post-update failure never changes or misreports the AcornOps decision. Without callback configuration, the bot links to `ACORNOPS_CONSOLE_BASE_URL` as a fallback. Raw tool arguments are never rendered.
- If a chat answer is still running after the brief immediate polling window, the bot follows the run with AcornOps SSE and posts the final assistant answer back to the same Mattermost channel when it completes.
- `!chat end` is valid inside a registered chat thread and closes only that chat. `!chat pause` and `!chat resume` are retired from the main UX because the main bot conversation stays available while chat threads remain open. `!ask <question>`, `!sessions`, `!session`, and `!messages` remain compatibility commands but are not part of the short help surface.
- `!webhook create`, `!webhook connect`, `!webhook status`, `!webhook recreate`, and `!webhook disconnect` manage the current Mattermost user's user-level AcornOps alert route. `create` returns the delivery URL to paste into AcornOps console. `connect` claims console-created subscription metadata and signing secrets from AcornOps over authenticated TLS. `status` refreshes live AcornOps subscription state when available and never reveals signing secrets.
- Signed webhook issue alerts omit raw workspace, target, and issue ids from the Mattermost notice. Alert timestamps render in `BOT_ALERT_TIME_ZONE`, which defaults to `Asia/Singapore`.
- Created and reopened Mattermost issue alerts include `Run Triage` when interactive callbacks are configured. This is a Mattermost issue-alert action, not a webhook operation. The callback verifies the acting user, reloads the issue, checks recent target chat activity, and either links to the existing AcornOps cluster chat or creates a read-only cluster session and streams its console-equivalent triage prompt in a new Mattermost thread. Resolved alerts do not include the action.
- Only `!login` is direct-message-only. Authenticated read, read-only assistant, and user webhook routing commands can run in direct messages or channel mentions.
- The bot does not keep bot-side login state or AcornOps browser sessions. It keeps only lightweight ids, names, thread mappings, active-run references, a hashed AcornOps account fingerprint, login-validation flags, webhook routes, and inbound event ids for command convenience.
- `MATTERMOST_URL` defaults to `http://localhost:8065`, and `ACORNOPS_API_BASE_URL` defaults to `http://localhost:8081`, the standalone AcornOps control-plane URL.

## Message Flow

1. `src/bot/index.js` loads `.env`, then asks `src/bot/config.js` for Mattermost, AcornOps, chat timing, database, and inbound HTTP configuration.
2. `src/bot/mattermost-client.js` uses the shared JSON request helper in `src/bot/http-client.js` and verifies the token with `GET /api/v4/users/me`.
3. `src/bot/state/postgres-store.js` creates an in-memory store for tests/dev or loads/migrates Postgres state when `BOT_DATABASE_URL` is configured.
4. `src/bot/server.js` starts the optional built-in HTTP listener for health checks, Mattermost actions, and AcornOps webhooks when `BOT_HTTP_PORT` is non-zero.
5. `src/bot/runner.js` opens `/api/v4/websocket` and authenticates the WebSocket connection.
6. Mattermost emits `posted` events for new messages the bot can see.
7. `src/bot/runner.js` extracts the Mattermost user id from the Mattermost post author and ignores bot-authored posts.
8. If the post is a reply with a `root_id` matching a registered chat or workflow thread for that channel, the runner routes it to that AcornOps conversation even when the bot is not mentioned.
9. Otherwise `src/bot/message.js` accepts direct messages and channel posts that mention the configured bot username, then rejects slash-prefixed input and requires a `!` command word.
10. `!login` direct messages resolve the current link. Already-linked users get confirmation; unlinked or expired users get the `linkUrl` exactly as AcornOps sent it and the bot marks account validation pending.
11. The first authenticated command after a pending login resolves once. If the AcornOps user fingerprint matches the stored hash, context remains; if it changed, the bot clears command/thread context before running the command.
12. `!status` asks AcornOps whether the Mattermost identity is durably linked.
13. `!workspaces` asks AcornOps for the current user's workspace page, formats numbered workspace rows, stores lightweight workspace references, and optionally attaches Mattermost workspace-selection buttons.
14. `!workspace 1` selects current workspace and clears current target/session state.
15. `!targets` uses the current workspace and updates numbered generic target references; `!clusters` and `!vms` remain shortcuts.
16. `!target 1`, `!cluster 1`, and `!vm 1` select exactly one current target and clear the previous target plus current session state.
17. `!workflows` stores lightweight numbered references. `!workflow run` refreshes available definitions, validates declared inputs and `resourceRequirements`, materializes the selected target as `@target[...]`, persists a source-post launch reservation, creates or reuses its workflow session with the exact `capabilityPolicy.contextGrants`, sends content plus the post-derived `clientRequestId`, posts `**Workflow launched: <name>**`, persists the thread mapping and launch target, and follows the returned execution. Concurrent or replayed delivery of the same Mattermost post reuses the same reservation and AcornOps session.
18. `!chat new [title]` creates a read-only troubleshooting session. `!chat new --write [title]` refreshes workspace details, checks the effective `create_read_write_runs` permission, and creates a session whose thread persists read-write access mode.
19. The runner posts the chat acknowledgement, creates the Mattermost root-thread post, and stores the returned `root_id` keyed by `channel_id + root_id`.
20. Replies post session messages with the thread's persisted `toolAccessMode` and stable `clientMessageId` values derived from the Mattermost source post id when available.
21. After posting a chat message, the bot polls the read-only run briefly, fetches session messages when the run completes, and renders the newest assistant reply for that run. The default response window is 15 poll attempts with a 1000 ms interval, configured by `CHAT_RUN_POLL_ATTEMPTS` and `CHAT_RUN_POLL_INTERVAL_MS`.
22. If the run is still active after the response window, the bot records one active streamed run for that chat thread, returns a short acknowledgement in the thread, and starts `src/bot/chat/follower.js` in the background.
23. Troubleshooting followers open `GET /api/v1/runs/{runId}/stream`. Workflow followers open `GET /api/v1/workflow-executions/{executionId}/stream`, persist the replay cursor, discover all step attempts, and follow execution-level terminal state. Approval requests, decisions, and terminal results stay in the same thread.
24. If SSE disconnects before a terminal state, the follower checks the run or aggregate workflow execution, reconnects up to 3 times, then falls back to bounded polling. A still-active workflow remains registered and repeats that cycle after `WORKFLOW_FOLLOW_RETRY_DELAY_MS`; it is cleared only after terminal delivery or explicit thread cancellation. Replay cursors and approval dedupe markers advance only after required Mattermost posts succeed.
25. Interactive button contexts contain only expiring HMAC-signed tokens. `MATTERMOST_ACTION_SECRET` remains server-side, signs a purpose-bound action token and a separate short-lived approval-dialog state token, and is required before the bot exposes any button.
26. `src/bot/mattermost-client.js` posts responses with `POST /api/v4/posts`, including `root_id`, `props`, and attachment/action payloads when provided.

## Command Context

Current workspace, target, session, thread, and webhook route state are Mattermost chat conveniences, not AcornOps concepts.

The store is keyed primarily by external user id. With `BOT_DATABASE_URL`, `src/bot/state/postgres-store.js` persists the same shape in Postgres and loads it at startup. Without `BOT_DATABASE_URL`, the bot uses the in-memory implementation for tests and simple local development.

The store keeps:

- the most recent workspace list as `{ id, name }` references for numbered commands;
- the most recent workflow list as `{ id, name }` references for numbered commands;
- up to 50 recent initial workflow launch reservations per user, keyed by the exact originating Mattermost post id and carrying its session/request/execution references;
- the current workspace as `{ id, name }`;
- the most recent generic target list and current generic target as `{ id, name, type, source }`, where `source` distinguishes generic target selections from compatibility cluster/VM selections for session routing;
- the most recent cluster list and current cluster as `{ id, name }`;
- the most recent VM list and current VM as `{ id, name }`;
- the most recent session list and current session as `{ id, name }`;
- the latest run id/status/session reference;
- a hashed AcornOps account fingerprint, login-validation-pending flag, and context generation;
- conversation-thread records keyed by Mattermost `channel_id + root_id`, including creator, kind, session, title, closed state, and workflow launch context where applicable;
- active streamed run pointers keyed by chat thread, including workflow `executionId`, current `runId`, and replay cursor;
- user-level AcornOps webhook alert routes;
- inbound webhook event ids for idempotency.

Only one target can be selected at a time. Selecting a workspace clears remembered workflows plus the current target, cluster, VM, session, and latest run. Selecting a target, cluster, or VM clears the previous target-specific session and latest run. Each conversation thread follows at most one active streamed run; one user can keep multiple threads open at the same time.

Postgres persistence makes command context, workflow launch reservations, chat-thread lookup, login-triggered account validation state, webhook routes, active run records, and inbound event ids restart-resilient. Active SSE network followers are still process-local while running; on restart the active run record remains available for future recovery work, but no resume worker is implemented yet.

## Inbound HTTP

The bot can run one built-in HTTP listener:

- `GET /healthz` returns basic readiness.
- `POST /mattermost/actions` handles interactive Mattermost buttons and approval-dialog submissions. Workspace selection, target selection, issue triage, and approvals verify an expiring action token signed by the server-only action secret plus the acting Mattermost user. Approval dialogs additionally carry purpose-bound, short-lived signed run/approval context; AcornOps independently enforces exact integration-link and client origin. Issue triage uses the target issues and recent chat activity APIs before linking to AcornOps or creating a threaded run.
- `POST /acornops/webhooks/routes/:routeToken` handles signed AcornOps webhook deliveries. The route token identifies the Mattermost destination, and the handler verifies `AcornOps-Timestamp` plus `AcornOps-Signature`, rejects stale timestamps, requires and deduplicates `AcornOps-Event-Id`, and posts the alert to Mattermost.
- Issue lifecycle events `issue.created.v1`, `issue.reopened.v1`, and `issue.resolved.v1` render as rich Mattermost issue alerts with title, emphasized severity, summary, and issue timestamps. Created and reopened alerts emphasize `lastSeenAt` and offer `Run Triage`; resolved alerts emphasize `resolvedAt` and include `lastSeenAt` when available. Other event types render as generic AcornOps info alerts with title and occurred timestamp fallback. Alert notices avoid ID-only workspace, target, issue, and subject lines.

Mattermost and AcornOps must be able to reach `BOT_PUBLIC_BASE_URL` for interactive actions and webhooks in any live environment.

Webhook route tokens are stored as hashes for lookup. AcornOps subscription signing secrets are stored in bot Postgres as deployment-secret data because HMAC validation requires the original secret. AcornOps remains the source of truth for workspace and event subscription state; the bot caches the latest snapshot for fallback status output.

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
