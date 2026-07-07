<p align="center">
  <img width="220" src="https://raw.githubusercontent.com/acornops/docs-website/main/logo/light.svg" alt="AcornOps" />
</p>

<h1 align="center">AcornOps Mattermost Bot</h1>

<p align="center">
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22-green.svg" alt="Node >=22" /></a>
  <img src="https://img.shields.io/badge/mattermost-bot-blue.svg" alt="Mattermost bot" />
  <img src="https://img.shields.io/badge/external_integrations-AcornOps-blue.svg" alt="AcornOps external integrations" />
</p>

<p align="center">
  Official Mattermost bot plugin for AcornOps external integrations.
</p>

## Status

This repository owns the AcornOps Mattermost ChatOps bot runtime, command handling, AcornOps external integration client, Mattermost adapter, automated tests, and repo-local validation. It is no longer a learning repository.

The bot is part of the official AcornOps offering. Full-system deployment wiring belongs in `acornops-deployment`; cross-repository coordination belongs in `acornops-workspace`.

## System Role

The Mattermost bot gives Mattermost users a chat entry point into AcornOps:

1. Users talk to `@acorn-ops-bot` in a direct message or mention it in a channel.
2. `!login` creates an AcornOps external integration account-link request.
3. `!status` resolves the linked AcornOps identity for the observed Mattermost user.
4. Read commands call AcornOps control-plane APIs with service authentication and `x-acornops-external-user-id`.
5. `!chat new` creates a dedicated Mattermost thread for each read-only AcornOps assistant session.

The bot never asks users for AcornOps passwords in Mattermost and does not store AcornOps browser sessions, cookies, OIDC tokens, refresh tokens, or raw link tokens.

## Repository Boundaries

This repository owns:

- Mattermost WebSocket event handling and REST replies
- `!`-prefixed bot command parsing for `@acorn-ops-bot`
- external integration link and resolve calls to AcornOps
- read-only workspace, target, resource, finding, investigation, and threaded assistant command surfaces
- persistent command context for numbered workspaces, targets, sessions, chat-thread mappings, active streamed assistant runs, and user-level webhook routes
- optional inbound HTTP callbacks for Mattermost interactive actions and AcornOps alert webhooks
- repo-local lint, build, and test verification

This repository does not own:

- AcornOps control-plane API implementation, auth, persistence, or authorization
- management console UI
- execution-engine or llm-gateway behavior
- Kubernetes or VM agent runtime behavior
- production deployment orchestration, image pinning, environment templates, or operator runbooks

Use `acornops-workspace` for coordinated multi-repo changes, and `acornops-deployment` for full-stack local, VM, and Kubernetes deployment tracks.

## Contracts

The bot depends on the AcornOps control-plane external integration contract:

- `POST /api/v1/auth/external-integrations/link`
- `POST /api/v1/auth/external-integrations/resolve`
- authenticated read APIs under `/api/v1/workspaces`, `/api/v1/sessions`, and `/api/v1/runs`
- `GET /api/v1/runs/{runId}/stream` for long-running assistant follow-up delivery

The bot authenticates to AcornOps with `EXTERNAL_INTEGRATION_SERVICE_TOKEN`. The external user id is always derived from the observed Mattermost post author id; it is never accepted from user-typed chat text.

Operational read calls include:

- `Authorization: Bearer <EXTERNAL_INTEGRATION_SERVICE_TOKEN>`
- `x-acornops-external-user-id: <mattermost user id>`

Update this repository and `control-plane` together through `acornops-workspace` when external integration endpoints, request bodies, response shapes, or authorization semantics change.

## Runtime Configuration

Environment variables:

| Variable | Description | Default |
| --- | --- | --- |
| `MATTERMOST_URL` | Mattermost site URL. | `http://localhost:8065` |
| `MATTERMOST_BOT_TOKEN` | Mattermost bot access token. | Required |
| `MATTERMOST_BOT_USERNAME` | Bot username used for mention detection. | `acorn-ops-bot` |
| `ACORNOPS_API_BASE_URL` | AcornOps control-plane base URL. | `http://localhost:8081` |
| `EXTERNAL_INTEGRATION_SERVICE_TOKEN` | AcornOps service token for this installed external integration. | Required for AcornOps-backed commands |
| `BOT_DATABASE_URL` | Optional Postgres URL for persistent bot command context, chat threads, active runs, webhook routes, and inbound idempotency. Compose supplies a bundled Postgres URL; empty uses in-memory state for local tests. | Empty |
| `BOT_HTTP_HOST` | Host for the optional inbound bot HTTP listener. | `0.0.0.0` |
| `BOT_HTTP_PORT` | Port for the inbound bot HTTP listener. `0` disables listening. | `0` |
| `BOT_PUBLIC_BASE_URL` | Public base URL used in Mattermost interactive action callbacks and AcornOps webhook delivery URLs. Required for workspace buttons and `!webhook create`. | Empty |
| `MATTERMOST_ACTION_SECRET` | Shared secret embedded in Mattermost action contexts. | Empty |
| `CHAT_RUN_POLL_ATTEMPTS` | Immediate chat run polling attempts before SSE follow-up. | `15` |
| `CHAT_RUN_POLL_INTERVAL_MS` | Immediate chat run polling interval in milliseconds. | `1000` |
| `RUN_STREAM_RECONNECT_ATTEMPTS` | SSE reconnect attempts before fallback polling. | `3` |
| `RUN_STREAM_RECONNECT_DELAY_MS` | Delay between SSE reconnect attempts in milliseconds. | `1000` |
| `RUN_STREAM_FALLBACK_POLL_INTERVAL_MS` | Fallback run polling interval in milliseconds. | `3000` |
| `RUN_STREAM_FALLBACK_POLL_MAX_MS` | Maximum fallback run polling duration in milliseconds. | `180000` |

Local `.env` files are loaded without overriding existing process environment values.

## Commands

Commands are plain Mattermost messages, not slash commands. Command words require `!`; arguments do not. Slash-prefixed input returns guidance to use `!`.

- `!help`: show the short common workflow
- `!help filters`: show supported filters and finite values
- `!login`: create an AcornOps account-link request; direct-message only
- `!status`: show linked or unlinked account state plus current context
- `!workspaces`: list accessible workspaces, with selection buttons when callback config is present
- `!workspaces 1`: show workspace details without changing current workspace
- `!workspace 1`: select a workspace
- `!workspace`: show the current workspace
- `!targets`: list Kubernetes and VM targets in the current workspace, with selection buttons when callback config is present
- `!target 1`: select a target
- `!resources`: list resources for the selected target
- `!findings`: list findings for the selected target
- `!investigations`: list workspace investigations
- `!chat new [title]`: create a read-only troubleshooting chat for the selected target and post a dedicated Mattermost root thread
- `!chat end`: inside a chat thread, close only that chat and stop following its active answer
- `!webhook create`: create or show the current user's AcornOps webhook delivery URL for the current Mattermost destination
- `!webhook connect`: claim AcornOps console-created subscription metadata and signing secrets for that delivery URL
- `!webhook status`: refresh and show the current user-level webhook route without revealing signing secrets
- `!webhook recreate`: rotate the delivery URL route token
- `!webhook disconnect`: remove the current user's webhook route

After `!chat new`, reply in the generated Mattermost thread to send read-only assistant questions for that specific AcornOps session. Thread replies do not need `!`; assistant replies and long-running SSE follow-ups stay in that thread. The main bot direct message or channel mention remains available for normal `!` commands and additional `!chat new` threads. Advanced filters, shortcuts such as `!clusters` and `!vms`, and compatibility session commands are documented in [`docs/wiki-mattermost-bot-commands.md`](docs/wiki-mattermost-bot-commands.md).

Only `!login` is direct-message-only. Authenticated read, threaded assistant, and user webhook routing commands can run in direct messages or channel mentions.

## Local Development

Install dependencies:

```bash
npm install
```

Run the bot:

```bash
npm start
```

Run in watch mode:

```bash
npm run dev
```

Build the container image:

```bash
docker build -t acornops-mattermost-bot:local .
```

Verify the container image build:

```bash
./scripts/verify-docker.sh
```

Run the container with runtime environment injected at start:

```bash
docker run --rm --env-file .env acornops-mattermost-bot:local
```

Run with Docker Compose:

```bash
docker compose up --build
```

Compose starts a bundled `bot-postgres` service and defaults `BOT_DATABASE_URL` to that database. It also defaults `MATTERMOST_URL` to `http://host.docker.internal:8065`, `ACORNOPS_API_BASE_URL` to `http://host.docker.internal:8081`, and `BOT_PUBLIC_BASE_URL` to `http://host.docker.internal:8080`, which lets Mattermost and AcornOps containers reach the bot callback listener through Docker Desktop. Keep `MATTERMOST_BOT_TOKEN` and `EXTERNAL_INTEGRATION_SERVICE_TOKEN` in your local `.env` or shell environment.

The image installs dependencies from `package*.json` inside Docker. It does not copy host `node_modules` and does not bake local `.env` files into the image. It exposes the optional bot HTTP port for Mattermost actions and AcornOps webhooks; the listener only binds when `BOT_HTTP_PORT` is non-zero.

The local Mattermost and AcornOps services are not started by this repository. For full-platform local bring-up, use:

```bash
cd ../acornops-deployment
task local-up
```

Do not run overlapping local stacks on the same host ports.

## Production Notes

- Configure a dedicated Mattermost bot account named `acorn-ops-bot`.
- Store the Mattermost bot token and AcornOps external integration service token in the deployment secret manager, not in committed files.
- Keep the external integration token scoped to the installed Mattermost integration.
- Run behind the deployment topology owned by `acornops-deployment`.
- Use Postgres through `BOT_DATABASE_URL` for restart-resilient command context, chat-thread mappings, active run records, user webhook routes, and inbound webhook idempotency.
- `BOT_PUBLIC_BASE_URL` must be reachable by Mattermost for interactive actions and by AcornOps for webhook deliveries.
- Webhook delivery URLs include an opaque route token. AcornOps console-created subscriptions send signed deliveries to that URL; `!webhook connect` claims the AcornOps subscription metadata and signing secrets over authenticated TLS. Signing secrets are stored in bot Postgres as deployment-secret data so HMAC validation can run.
- Treat channel responses as potentially visible to the whole channel. Login remains direct-message-only; read and assistant commands are intentionally channel-capable.
- Rotate service tokens through AcornOps control-plane procedures and restart the bot runtime after secret updates.

## Documentation

Primary docs:

- [`AGENTS.md`](AGENTS.md)
- [`docs/bot-runtime.md`](docs/bot-runtime.md)
- [`docs/wiki-mattermost-bot-commands.md`](docs/wiki-mattermost-bot-commands.md)
- [`docs/bot-integrations.md`](docs/bot-integrations.md)
- [`docs/bot-auth-sessions.md`](docs/bot-auth-sessions.md)
- [`docs/acornops-api-inventory.md`](docs/acornops-api-inventory.md)
- [`PROGRESS.md`](PROGRESS.md)
- [`feature_list.json`](feature_list.json)
- Whole-system architecture and cross-repo workflow live in `acornops-workspace`.
- Deployment runbooks and environment templates live in `acornops-deployment`.

Historical local learning notes remain under `docs/` for traceability, but production implementation work should follow the AcornOps repository boundaries above.

## Validation

Run the checks that match the change:

```bash
npm run lint
npm run build
npm test
npm run verify:bot
./init.sh
```

Use Mattermost and AcornOps live smoke testing when command behavior, account linking, or deployment configuration changes.
