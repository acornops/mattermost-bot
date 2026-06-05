# Bot Runtime

This note records the `B01` bot runtime scaffold decision and the commands a future session should use.

## Decision

Use Node.js with ECMAScript modules and built-in runtime APIs for the first Mattermost bot-account process.

The first scaffold intentionally avoids Express, Fastify, TypeScript, databases, queues, or third-party Mattermost clients. The dependency-light bot validates Mattermost bot identity, message handling, local command lifecycle, and the first AcornOps OIDC login link.

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
CSIT_MATTERMOST_URL=http://localhost:8065 \
CSIT_MATTERMOST_TOKEN=replace-with-bot-token \
CSIT_MATTERMOST_BOT_USERNAME=acorn-ops-bot \
CSIT_ACORNOPS_URL=http://localhost:8081 \
CSIT_ACORNOPS_LOGIN_RETURN_TO=/api/v1/me \
npm start
```

## Current Behavior

- The bot authenticates to Mattermost as a bot account using `CSIT_MATTERMOST_TOKEN`.
- The bot opens Mattermost's WebSocket endpoint and authenticates after connecting.
- The bot responds to direct messages and channel posts that mention `@acorn-ops-bot`.
- The bot posts responses as normal channel messages instead of threaded replies.
- The bot ignores messages authored by itself.
- `login` in a direct message generates an AcornOps control-plane `GET /api/v1/auth/oidc/login` browser link and records pending chat login state by Mattermost user id.
- If `CSIT_ACORNOPS_CHAT_SERVICE_TOKEN` is set, `login` first asks AcornOps to create a Mattermost chat-login transaction and uses that backend-owned login link instead.
- `login` in a shared channel does not call AcornOps; it asks the user to direct-message `@acorn-ops-bot`.
- `status` shows the local chat identity and whether an AcornOps login is pending or connected. With a backend chat-login transaction, `status` also refreshes the transaction and stores the completed AcornOps user/session if AcornOps reports completion.
- `clusters` remains a placeholder until cluster listing is wired to the AcornOps API.
- `CSIT_ACORNOPS_URL` defaults to `http://localhost:8081`, the standalone AcornOps control-plane URL.
- `CSIT_ACORNOPS_LOGIN_RETURN_TO` defaults to `/api/v1/me`, so a completed browser login shows the AcornOps user JSON until the management console or a chat-completion callback is available.

## Message Flow

1. `src/bot/index.js` reads `CSIT_MATTERMOST_URL`, `CSIT_MATTERMOST_TOKEN`, `CSIT_MATTERMOST_BOT_USERNAME`, and `CSIT_ACORNOPS_URL`.
2. `src/bot/mattermost-client.js` verifies the token with `GET /api/v4/users/me`.
3. `src/bot/runner.js` opens `/api/v4/websocket` and authenticates the WebSocket connection.
4. Mattermost emits `posted` events for new messages the bot can see.
5. `src/bot/message.js` ignores bot-authored posts, accepts direct messages, and accepts channel posts that mention `@acorn-ops-bot`.
6. `login` direct messages call `src/bot/acornops-client.js` to create a backend Mattermost chat-login transaction when `CSIT_ACORNOPS_CHAT_SERVICE_TOKEN` is configured; otherwise they build a plain OIDC browser login URL.
7. `src/bot/mattermost-client.js` posts the response with `POST /api/v4/posts` and no `root_id`, so Mattermost renders it in the main timeline instead of a thread.

## AcornOps Login Stage

The current `login` command starts AcornOps OIDC in the browser and keeps a short-lived pending login record on the bot side.

AcornOps already owns browser OIDC and cookie-backed user sessions. The bot does not collect passwords, does not ask users to paste session cookies into Mattermost, and no longer calls the non-production `dev-login` endpoint for command login.

The bot now supports a proposed AcornOps completion contract:

- `POST /api/v1/auth/chat/mattermost/login` creates a pending backend transaction and returns a login URL.
- `GET /api/v1/auth/chat/mattermost/login/{id}` lets the bot refresh transaction state and store the completed AcornOps user plus opaque chat session token.

The remaining integration gap is on the AcornOps side: those endpoints are not present yet, so local runs without `CSIT_ACORNOPS_CHAT_SERVICE_TOKEN` continue using the honest pending OIDC-link fallback. See `docs/acornops-api-inventory.md` and `docs/bot-auth-sessions.md`.

## Local Mattermost Account Target

- Bot username: `acorn-ops-bot`
- Display name: `AcornOps Bot`
- Token storage: local environment only; do not commit bot tokens.
- First verification path: send a direct message or channel mention to `@acorn-ops-bot` from a non-bot user and record the response evidence.

## Runtime Versions

- Node.js verified locally: `v25.8.1`
- npm verified locally: `11.11.0`
- Minimum Node.js declared in `package.json`: `>=22`
