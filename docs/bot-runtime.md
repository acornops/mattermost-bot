# Bot Runtime

This note records the bot runtime scaffold decision and the commands a future session should use.

## Decision

Use Node.js with ECMAScript modules and built-in runtime APIs for the first Mattermost bot-account process.

The first scaffold intentionally avoids Express, Fastify, TypeScript, databases, queues, or third-party Mattermost clients. The dependency-light bot validates Mattermost bot identity, message handling, local command lifecycle, and the AcornOps external integration account-link contract.

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
CSIT_MATTERMOST_URL=http://localhost:8065
CSIT_MATTERMOST_TOKEN=replace-with-bot-token
CSIT_MATTERMOST_BOT_USERNAME=acorn-ops-bot

ACORNOPS_API_BASE_URL=http://localhost:8081
EXTERNAL_INTEGRATION_SERVICE_TOKEN=replace-with-acornops-external-integration-token
```

## Current Behavior

- The bot authenticates to Mattermost as a bot account using `CSIT_MATTERMOST_TOKEN`.
- The bot opens Mattermost's WebSocket endpoint and authenticates after connecting.
- The bot responds to direct messages and channel posts that mention `@acorn-ops-bot`.
- The bot username defaults to `acorn-ops-bot`, and can be changed in one place at runtime with `CSIT_MATTERMOST_BOT_USERNAME`.
- The bot posts responses as normal channel messages instead of threaded replies.
- The bot ignores messages authored by itself.
- Commands are accepted without a leading slash only, for example `clusters`. Slash-prefixed commands return guidance to retry without `/`.
- `login` in a direct message calls AcornOps `POST /api/v1/auth/external-integrations/link` with `externalUserId` set to the Mattermost user id read from the post author and `externalDisplayName` set from the Mattermost sender name when available.
- `login` in a shared channel does not call AcornOps; it asks the user to direct-message `@acorn-ops-bot`.
- `status` calls AcornOps `POST /api/v1/auth/external-integrations/resolve` with the same external user id.
- `workspaces` calls AcornOps `GET /api/v1/workspaces?limit=50` with the external integration service token and `x-acornops-external-user-id` set to the observed Mattermost post author id.
- Workspace results are numbered. `workspaces 1` calls AcornOps `GET /api/v1/workspaces/{workspaceId}` for the remembered workspace id and shows details without changing the user's current workspace.
- `workspace 1` calls AcornOps `GET /api/v1/workspaces/{workspaceId}` for the remembered workspace id, shows details, and updates the user's current workspace.
- `workspace` shows details for the user's current workspace selection.
- `targets` calls AcornOps `GET /api/v1/workspaces/{workspaceId}/targets?limit=50` for the current workspace.
- `target 1` fetches `GET /api/v1/workspaces/{workspaceId}/targets/{targetId}` and updates the current generic target.
- `clusters`/`cluster 1` and `vms`/`vm 1` remain compatibility shortcuts over Kubernetes- and VM-specific endpoints.
- `resources` and `findings` list resources or findings for the currently selected target. They accept documented `key=value` filters where the AcornOps endpoint supports them.
- `investigations` lists snapshot-derived investigations for the current workspace.
- `help` shows only the common workflow. `help filters` shows supported filters and finite values. The full reference lives in `docs/wiki-mattermost-bot-commands.md`.
- `chat new` creates a read-only troubleshooting session for the selected target and enters chat mode. Generic `target 1` selections use AcornOps target session endpoints; compatibility `cluster 1` selections keep using Kubernetes cluster session endpoints. While chat mode is active, normal messages and command-looking text are posted to AcornOps as read-only assistant questions.
- If a chat answer is still running after the brief immediate polling window, the bot follows the run with AcornOps SSE and posts the final assistant answer back to the same Mattermost channel when it completes.
- `chat pause` leaves chat mode while preserving the current session and any active streamed answer, `chat resume` re-enters it, and `chat end` clears the bot's current chat pointer and aborts any active streamed answer. `ask <question>`, `sessions`, `session`, and `messages` remain compatibility commands but are not part of the short help surface.
- Only `login` is direct-message-only. Authenticated read and read-only assistant commands can run in direct messages or channel mentions.
- The bot does not keep bot-side login state or AcornOps browser sessions. It keeps only process-local command context containing lightweight ids and names for command convenience.
- `CSIT_MATTERMOST_URL` defaults to `http://localhost:8065`, and `ACORNOPS_API_BASE_URL` defaults to `http://localhost:8081`, the standalone AcornOps control-plane URL.

## Message Flow

1. `src/bot/index.js` loads `.env`, then asks `src/bot/config.js` for `CSIT_MATTERMOST_URL`, `CSIT_MATTERMOST_TOKEN`, `CSIT_MATTERMOST_BOT_USERNAME`, `ACORNOPS_API_BASE_URL`, and `EXTERNAL_INTEGRATION_SERVICE_TOKEN`.
2. `src/bot/mattermost-client.js` uses the shared JSON request helper in `src/bot/http-client.js` and verifies the token with `GET /api/v4/users/me`.
3. `src/bot/runner.js` opens `/api/v4/websocket` and authenticates the WebSocket connection.
4. Mattermost emits `posted` events for new messages the bot can see.
5. `src/bot/runner.js` extracts the Mattermost user id from the Mattermost post author.
6. `src/bot/message.js` uses helpers from `src/bot/message-utils.js` to ignore bot-authored posts, accept direct messages, and accept channel posts that mention the configured bot username.
7. Slash-prefixed commands are rejected before dispatch.
8. `login` direct messages ask AcornOps to create a short-lived account link and return the `linkUrl` exactly as AcornOps sent it.
9. `status` asks AcornOps whether the Mattermost identity is durably linked.
10. `workspaces` asks AcornOps for the current user's workspace page, formats numbered workspace rows, and stores lightweight workspace references in `src/bot/command-context.js`.
11. `workspace 1` selects current workspace and clears current cluster, VM, and session.
12. `targets` uses the current workspace and updates numbered generic target references; `clusters` and `vms` remain shortcuts.
13. `target 1`, `cluster 1`, and `vm 1` select exactly one current target and clear the previous target plus current chat/session state.
14. `chat new` creates a read-only troubleshooting session for the selected target. A target chosen through `target 1` uses `POST /api/v1/workspaces/{workspaceId}/targets/{targetId}/sessions`; a Kubernetes cluster chosen through the compatibility `cluster 1` command uses the Kubernetes-cluster session endpoint. While chat mode is active, free-form messages post session messages with `toolAccessMode: "read_only"` and stable `clientMessageId` values derived from the Mattermost source post id when available.
15. After posting a chat message, the bot polls the read-only run briefly, fetches session messages when the run completes, and renders the newest assistant reply for that run. The default response window is 15 poll attempts with a 1000 ms interval, configured by `CSIT_CHAT_RUN_POLL_ATTEMPTS` and `CSIT_CHAT_RUN_POLL_INTERVAL_MS`.
16. If the run is still active after the response window, the bot records one active streamed run for that external user, returns a short acknowledgement, and starts `src/bot/run-follower.js` in the background.
17. The run follower opens `GET /api/v1/runs/{runId}/stream` with `Authorization: Bearer EXTERNAL_INTEGRATION_SERVICE_TOKEN`, `x-acornops-external-user-id`, and `Accept: text/event-stream`. `run_completed` loads the newest assistant message for that run and posts it to Mattermost. `run_failed` and `run_cancelled` post concise terminal messages.
18. If SSE disconnects before a terminal state, the follower checks `GET /api/v1/runs/{runId}`, reconnects up to 3 times, then falls back to bounded polling. The reconnect and fallback defaults are controlled by `CSIT_RUN_STREAM_RECONNECT_ATTEMPTS`, `CSIT_RUN_STREAM_RECONNECT_DELAY_MS`, `CSIT_RUN_STREAM_FALLBACK_POLL_INTERVAL_MS`, and `CSIT_RUN_STREAM_FALLBACK_POLL_MAX_MS`.
19. `src/bot/mattermost-client.js` posts the response with `POST /api/v4/posts` and no `root_id`, so Mattermost renders it in the main timeline instead of a thread.

## Command Context

Current workspace, target, and session state are Mattermost chat conveniences, not AcornOps concepts.

The first implementation uses an in-memory store keyed by external user id. It stores only:

- the most recent workspace list as `{ id, name }` references for numbered commands;
- the current workspace as `{ id, name }`;
- the most recent generic target list and current generic target as `{ id, name, type, source }`, where `source` distinguishes generic target selections from compatibility cluster/VM selections for session routing;
- the most recent cluster list and current cluster as `{ id, name }`;
- the most recent VM list and current VM as `{ id, name }`;
- the most recent session list and current session as `{ id, name }`;
- the chat mode flag, latest run id/status/session reference, and one active streamed run pointer.

Only one target can be selected at a time. Selecting a workspace clears the current target, cluster, VM, session, and latest run. Selecting a target, cluster, or VM clears the previous target-specific session and latest run. V1 follows only one active streamed run per external user; a second chat question is rejected until that answer completes or the user sends `chat end`.

This state resets when the bot process restarts. Active SSE follows are process-local: if the bot crashes or restarts, AcornOps may finish the run but the bot will not post the final answer. If the bot becomes multi-replica or restart-resilient, replace `src/bot/command-context.js` and the run follower registry with shared TTL storage while keeping the command interface stable.

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
