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
2. `login` creates an AcornOps external integration account-link request.
3. `status` resolves the linked AcornOps identity for the observed Mattermost user.
4. Read commands call AcornOps control-plane APIs with service authentication and `x-acornops-external-user-id`.
5. Chat mode submits read-only AcornOps assistant messages for the selected workspace and target.

The bot never asks users for AcornOps passwords in Mattermost and does not store AcornOps browser sessions, cookies, OIDC tokens, refresh tokens, or raw link tokens.

## Repository Boundaries

This repository owns:

- Mattermost WebSocket event handling and REST replies
- plain bot command parsing for `@acorn-ops-bot`
- external integration link and resolve calls to AcornOps
- read-only workspace, target, resource, finding, investigation, and chat-mode command surfaces
- process-local conversational selection state for numbered workspaces, targets, sessions, active/paused chat mode, and one active streamed assistant run per user
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
| `CSIT_MATTERMOST_URL` | Mattermost site URL. | `http://localhost:8065` |
| `CSIT_MATTERMOST_TOKEN` | Mattermost bot access token. | Required |
| `CSIT_MATTERMOST_BOT_USERNAME` | Bot username used for mention detection. | `acorn-ops-bot` |
| `ACORNOPS_API_BASE_URL` | AcornOps control-plane base URL. | `http://localhost:8081` |
| `EXTERNAL_INTEGRATION_SERVICE_TOKEN` | AcornOps service token for this installed external integration. | Required for AcornOps-backed commands |

Local `.env` files are loaded without overriding existing process environment values.

## Commands

Commands are plain Mattermost messages, not slash commands. Slash-prefixed input returns guidance to retry without `/`.

- `help`: show the short common workflow
- `help filters`: show supported filters and finite values
- `login`: create an AcornOps account-link request; direct-message only
- `status`: show linked or unlinked account state plus current context
- `workspaces`: list accessible workspaces
- `workspaces 1`: show workspace details without changing current workspace
- `workspace 1`: select a workspace
- `workspace`: show the current workspace
- `targets`: list Kubernetes and VM targets in the current workspace
- `target 1`: select a target
- `resources`: list resources for the selected target
- `findings`: list findings for the selected target
- `investigations`: list workspace investigations
- `chat new`: create a read-only troubleshooting chat for the selected target
- `chat pause`: leave chat mode while keeping the session resumable
- `chat resume`: resume the latest paused chat session
- `chat end`: clear the current chat session pointer

When chat mode is active, ordinary messages and command-looking text such as `status`, `resources`, and `findings` are sent to AcornOps as read-only assistant questions. The bot briefly polls for fast answers, then follows long-running runs over SSE and posts the final assistant response back to the same Mattermost channel. Use `chat pause` before running normal commands; use `chat end` to stop following an active answer. Advanced filters, shortcuts such as `clusters` and `vms`, and compatibility session commands are documented in [`docs/wiki-mattermost-bot-commands.md`](docs/wiki-mattermost-bot-commands.md).

Only `login` is direct-message-only. Authenticated read and read-only assistant commands can run in direct messages or channel mentions.

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
- The current command context and active SSE run-following registry are process-local. Run a single bot replica or add shared TTL-backed command context and run-following state before deploying multiple active bot replicas.
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
