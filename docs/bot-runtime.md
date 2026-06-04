# Bot Runtime

This note records the `B01` bot runtime scaffold decision and the commands a future session should use.

## Decision

Use Node.js with ECMAScript modules and built-in runtime APIs for the first Mattermost bot-account process.

The first scaffold intentionally avoids Express, Fastify, TypeScript, databases, queues, or third-party Mattermost clients. The dependency-light bot validates Mattermost bot identity, message handling, local command lifecycle, and the first local AcornOps login call.

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
npm start
```

## Current Behavior

- The bot authenticates to Mattermost as a bot account using `CSIT_MATTERMOST_TOKEN`.
- The bot opens Mattermost's WebSocket endpoint and authenticates after connecting.
- The bot responds to direct messages and channel posts that mention `@acorn-ops-bot`.
- The bot posts responses as normal channel messages instead of threaded replies.
- The bot ignores messages authored by itself.
- `login` in a direct message calls AcornOps control-plane `POST /api/v1/auth/dev-login`, stores the returned session cookie in memory by Mattermost user id, and reports the AcornOps user identity.
- `login` in a shared channel does not call AcornOps; it asks the user to direct-message `@acorn-ops-bot`.
- `status` shows the local chat identity and whether the in-memory AcornOps login session is connected.
- `clusters` remains a placeholder until cluster listing is wired to the AcornOps API.
- `CSIT_ACORNOPS_URL` defaults to `http://localhost:8081`, the standalone AcornOps control-plane URL.

## Message Flow

1. `src/bot/index.js` reads `CSIT_MATTERMOST_URL`, `CSIT_MATTERMOST_TOKEN`, `CSIT_MATTERMOST_BOT_USERNAME`, and `CSIT_ACORNOPS_URL`.
2. `src/bot/mattermost-client.js` verifies the token with `GET /api/v4/users/me`.
3. `src/bot/runner.js` opens `/api/v4/websocket` and authenticates the WebSocket connection.
4. Mattermost emits `posted` events for new messages the bot can see.
5. `src/bot/message.js` ignores bot-authored posts, accepts direct messages, and accepts channel posts that mention `@acorn-ops-bot`.
6. `login` direct messages call `src/bot/acornops-client.js`; other commands are formatted by `src/bot/message.js`.
7. `src/bot/mattermost-client.js` posts the response with `POST /api/v4/posts` and no `root_id`, so Mattermost renders it in the main timeline instead of a thread.

## Local AcornOps Login Stage

This first stage uses AcornOps `dev-login`, which exists only outside production. It creates or reuses a local AcornOps user with a deterministic email derived from the Mattermost `user_id`:

```text
mattermost-<mattermost-user-id>@acorn-ops-bot.local
```

This is intentionally a local development bridge. The product login flow should move to OIDC so users authenticate with AcornOps in the browser and the callback links the AcornOps user to the Mattermost identity.

## Local Mattermost Account Target

- Bot username: `acorn-ops-bot`
- Display name: `AcornOps Bot`
- Token storage: local environment only; do not commit bot tokens.
- First verification path: send a direct message or channel mention to `@acorn-ops-bot` from a non-bot user and record the response evidence.

## Runtime Versions

- Node.js verified locally: `v25.8.1`
- npm verified locally: `11.11.0`
- Minimum Node.js declared in `package.json`: `>=22`
