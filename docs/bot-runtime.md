# Bot Runtime

This note records the bot runtime scaffold decision and the commands a future session should use.

## Decision

Use Node.js with ECMAScript modules and built-in runtime APIs for the first Mattermost bot-account process.

The first scaffold intentionally avoids Express, Fastify, TypeScript, databases, queues, or third-party Mattermost clients. The dependency-light bot validates Mattermost bot identity, message handling, local command lifecycle, and the AcornOps Mattermost account-link contract.

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
MATTERMOST_CHAT_SERVICE_TOKEN=replace-with-acornops-chat-token
```

## Current Behavior

- The bot authenticates to Mattermost as a bot account using `CSIT_MATTERMOST_TOKEN`.
- The bot opens Mattermost's WebSocket endpoint and authenticates after connecting.
- The bot responds to direct messages and channel posts that mention `@acorn-ops-bot`.
- The bot posts responses as normal channel messages instead of threaded replies.
- The bot ignores messages authored by itself.
- `login` and `/login` in a direct message call AcornOps `POST /api/v1/auth/chat/mattermost/link` with the Mattermost user id read from the post author.
- `login` in a shared channel does not call AcornOps; it asks the user to direct-message `@acorn-ops-bot`.
- `status` and `/status` call AcornOps `POST /api/v1/auth/chat/mattermost/resolve` with the same Mattermost user id.
- The bot does not keep bot-side login state or AcornOps sessions.
- `clusters` remains a placeholder until cluster listing is wired to the AcornOps API.
- `ACORNOPS_API_BASE_URL` defaults to `http://localhost:8081`, the standalone AcornOps control-plane URL.

## Message Flow

1. `src/bot/index.js` loads `.env.local` and `.env`, then reads `CSIT_MATTERMOST_URL`, `CSIT_MATTERMOST_TOKEN`, `CSIT_MATTERMOST_BOT_USERNAME`, `ACORNOPS_API_BASE_URL`, and `MATTERMOST_CHAT_SERVICE_TOKEN`.
2. `src/bot/mattermost-client.js` verifies the token with `GET /api/v4/users/me`.
3. `src/bot/runner.js` opens `/api/v4/websocket` and authenticates the WebSocket connection.
4. Mattermost emits `posted` events for new messages the bot can see.
5. `src/bot/runner.js` extracts the Mattermost user id from the Mattermost post author.
6. `src/bot/message.js` ignores bot-authored posts, accepts direct messages, and accepts channel posts that mention `@acorn-ops-bot`.
7. `login` direct messages ask AcornOps to create a short-lived account link and return the `linkUrl` exactly as AcornOps sent it.
8. `status` asks AcornOps whether the Mattermost identity is durably linked.
9. `src/bot/mattermost-client.js` posts the response with `POST /api/v4/posts` and no `root_id`, so Mattermost renders it in the main timeline instead of a thread.

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
