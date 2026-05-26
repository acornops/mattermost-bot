# Bot Runtime

This note records the `B01` bot runtime scaffold decision and the commands a future session should use.

## Decision

Use Node.js with ECMAScript modules and built-in runtime APIs for the first Mattermost bot-account process.

The first scaffold intentionally avoids Express, Fastify, TypeScript, databases, queues, or third-party Mattermost clients. The backend API contract is still pending, so a dependency-light bot is enough to validate Mattermost bot identity, message handling, and local command lifecycle.

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
CSIT_MATTERMOST_BOT_USERNAME=csit \
npm start
```

## Current Behavior

- The bot authenticates to Mattermost as a bot account using `CSIT_MATTERMOST_TOKEN`.
- The bot opens Mattermost's WebSocket endpoint and authenticates after connecting.
- The bot responds to direct messages and channel posts that mention `@csit`.
- The bot ignores messages authored by itself.
- `help`, `login`, `status`, and `clusters` return placeholder text responses.
- Backend authentication and cluster listing are placeholders until the backend API contract exists.

## Local Mattermost Account Target

- Bot username: `csit`
- Display name: `CSIT`
- Token storage: local environment only; do not commit bot tokens.
- First verification path: send a direct message or channel mention to `@csit` from a non-bot user and record the response evidence.

## Runtime Versions

- Node.js verified locally: `v25.8.1`
- npm verified locally: `11.11.0`
- Minimum Node.js declared in `package.json`: `>=22`
