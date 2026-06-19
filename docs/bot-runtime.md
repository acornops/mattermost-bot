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
EXTERNAL_INTEGRATION_SERVICE_TOKEN=replace-with-acornops-chat-token
```

## Current Behavior

- The bot authenticates to Mattermost as a bot account using `CSIT_MATTERMOST_TOKEN`.
- The bot opens Mattermost's WebSocket endpoint and authenticates after connecting.
- The bot responds to direct messages and channel posts that mention `@acorn-ops-bot`.
- The bot username defaults to `acorn-ops-bot`, and can be changed in one place at runtime with `CSIT_MATTERMOST_BOT_USERNAME`.
- The bot posts responses as normal channel messages instead of threaded replies.
- The bot ignores messages authored by itself.
- Commands are accepted without a leading slash only, for example `clusters`. Slash-prefixed commands return guidance to retry without `/`.
- `login` in a direct message calls AcornOps `POST /api/v1/auth/chat/integration/link` with `externalUserId` set to the Mattermost user id read from the post author.
- `login` in a shared channel does not call AcornOps; it asks the user to direct-message `@acorn-ops-bot`.
- `status` calls AcornOps `POST /api/v1/auth/chat/integration/resolve` with the same external user id.
- `workspaces` calls AcornOps `GET /api/v1/workspaces?limit=50` with the external integration service token and `x-acornops-external-user-id` set to the observed Mattermost post author id.
- Workspace results are numbered. `workspaces 1` calls AcornOps `GET /api/v1/workspaces/{workspaceId}` for the remembered workspace id and shows details without changing the user's current workspace.
- `workspace 1` calls AcornOps `GET /api/v1/workspaces/{workspaceId}` for the remembered workspace id, shows details, and updates the user's current workspace.
- `workspace` shows details for the user's current workspace selection.
- `clusters` calls AcornOps `GET /api/v1/workspaces/{workspaceId}/kubernetes-clusters?limit=50` for the current workspace.
- `clusters 1` calls AcornOps `GET /api/v1/workspaces/{workspaceId}/kubernetes-clusters/{clusterId}` for a remembered cluster and shows details without changing the current cluster.
- `cluster 1` fetches cluster detail and updates the current cluster. Selecting a cluster clears the current VM and current session.
- `resources` and `findings` list resources or findings for the currently selected cluster or VM.
- `investigations` lists snapshot-derived investigations for the current workspace.
- `vms` lists VMs in the current workspace. `vms 1` shows VM detail without selecting it, and `vm 1` selects the current VM. Selecting a VM clears the current cluster and current session.
- `sessions` lists sessions for the selected cluster or VM. `session new` creates a read-only troubleshooting session for the selected target. `session 1` selects a session. `messages` lists current-session messages. `ask <question>` posts a read-only assistant message and returns the AcornOps message and run ids.
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
12. `clusters`, `vms`, and related detail commands use the current workspace and update numbered target references.
13. `cluster 1` and `vm 1` select exactly one current target and clear the previous target plus current session.
14. `session new` creates a read-only troubleshooting session for the selected target, while `ask <question>` posts a session message with `toolAccessMode: "read_only"`.
15. `src/bot/mattermost-client.js` posts the response with `POST /api/v4/posts` and no `root_id`, so Mattermost renders it in the main timeline instead of a thread.

## Command Context

Current workspace, target, and session state are Mattermost chat conveniences, not AcornOps concepts.

The first implementation uses an in-memory store keyed by external user id. It stores only:

- the most recent workspace list as `{ id, name }` references for numbered commands;
- the current workspace as `{ id, name }`;
- the most recent cluster list and current cluster as `{ id, name }`;
- the most recent VM list and current VM as `{ id, name }`;
- the most recent session list and current session as `{ id, name }`.

Only one target can be selected at a time. Selecting a workspace clears the current cluster, VM, and session. Selecting a cluster clears the current VM and session. Selecting a VM clears the current cluster and session.

This state resets when the bot process restarts. If the bot becomes multi-replica or restart-resilient, replace `src/bot/command-context.js` with shared TTL storage while keeping the command interface stable.

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
