# Bot Runtime

This note records the `B01` bot runtime scaffold decision and the commands a future session should use.

## Decision

Use Node.js with ECMAScript modules and the built-in `node:http` server for the first `/csit` slash command receiver.

The first scaffold intentionally avoids Express, Fastify, TypeScript, databases, queues, or Mattermost REST API clients. The backend API contract is still pending, so a dependency-light receiver is enough to validate the Mattermost command shape, token handling, and local command lifecycle.

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

Run the local bot server:

```sh
CSIT_MATTERMOST_COMMAND_TOKEN=replace-with-mattermost-token npm start
```

The local slash command request URL is:

```text
http://127.0.0.1:3000/mattermost/slash/csit
```

The health check URL is:

```text
http://127.0.0.1:3000/healthz
```

## Current Behavior

- `GET /healthz` returns JSON health status.
- `POST /mattermost/slash/csit` accepts Mattermost custom slash command form posts.
- The receiver validates the Mattermost slash command token against `CSIT_MATTERMOST_COMMAND_TOKEN`.
- `/csit help`, `/csit login`, `/csit status`, and `/csit clusters` return ephemeral JSON responses.
- Backend authentication and cluster listing are placeholders until the backend API contract exists.

## Runtime Versions

- Node.js verified locally: `v25.8.1`
- npm verified locally: `11.11.0`
- Minimum Node.js declared in `package.json`: `>=20`
