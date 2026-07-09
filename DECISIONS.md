# Decision Log

## 2026-07-09: Run external workflows in dedicated Mattermost threads

- Decision: Expose active read-only workflows through `!workflows` and `!workflow run <number|id> [key=value...]`. Each accepted launch creates a root post named `**Workflow launched: <name>**`; streamed output and plain-text follow-ups use the same persisted AcornOps workflow session. `!chat end` closes either conversation kind.
- Reason: Workflow runs can outlive a command response and need the same visible, concurrent conversation boundary already proven by assistant chat threads. The supplied AcornOps contract also requires exact context grants and returns final workflow output on the generic run resource.
- Consequence: Thread records now carry a `chat` or `workflow` kind plus workflow id, workspace id, and launch inputs. Target bindings always come from the current bot selection, only one run is followed per thread, and the bot continues to deny mutation, scheduling, approval, cancellation, read-write, paused/draft, and approval-gated workflow operations. Workflow message idempotency and restart-time follower recovery remain backend/future-work limitations.

## 2026-07-07: Use AcornOps-owned subscription state for Mattermost webhook routes

- Decision: Mattermost users get one bot-owned delivery URL through `!webhook create`, configure that URL in AcornOps console, then run `!webhook connect` so the bot claims AcornOps subscription metadata and signing secrets over authenticated TLS. `!webhook status` refreshes live AcornOps subscription state and falls back to cached state only with a stale warning.
- Reason: Copying both a URL and signing secret into every workspace is poor UX, while accepting setup secrets through the public webhook listener or embedding secrets in URLs is not secure. AcornOps should remain authoritative for workspace/event subscription state and browser-console permission checks.
- Consequence: The bot stores one provider-neutral route per Mattermost user plus claimed AcornOps subscription snapshots and signing secrets. AcornOps' supplied webhook route endpoints use exact delivery URL matching, `permissions.manage_webhooks` filtering, connect-time signing secret rotation, and `unconfigured`/`configured`/`connected` status values; `docs/acornops-mattermost-webhook-contract.md` records that contract for live end-to-end setup.

## 2026-07-07: Keep bot context headers and status messages concise

- Decision: Context-bearing Mattermost command replies start with `Current: Workspace: <name>    |    Target: <name>` and a divider, rather than a repeated multi-line identity/context block. `!status` reports linked/unlinked account state and current workspace/target only, omitting Mattermost user ids, backend AcornOps user ids, and chat/session selection.
- Reason: The previous responses repeated long context and identity details, making command output harder to scan in Mattermost. Workspace and target selection are the useful operational context; chat threads already carry chat state.
- Consequence: New commands should reuse the shared compact context formatter when they need current context. Object list/detail responses may still show AcornOps object ids where ids are useful for explicit selection, troubleshooting, or support.

## 2026-07-03: Use per-route signed webhook delivery URLs and bundled Compose Postgres

- Decision: Replace the global `POST /acornops/webhooks` intake and `ACORNOPS_WEBHOOK_SECRET` with per-user delivery URLs at `POST /acornops/webhooks/routes/:routeToken`. `!webhook connect` returns the route URL plus a per-route HMAC signing secret, and Compose starts a bundled Postgres service for durable bot state.
- Reason: Smoke testing showed the global secret flow was too manual for users and that Docker deployment fell back to in-memory state. Per-route URLs are easier to hand to AcornOps, while mandatory HMAC still protects each delivery.
- Consequence: Backward compatibility for the old global webhook endpoint is intentionally not preserved during testing. Route tokens are looked up by hash; signing secrets are stored as bot deployment-secret data because HMAC validation needs the original secret. Compose defaults `BOT_PUBLIC_BASE_URL` to a Mattermost-reachable `host.docker.internal` URL.

## 2026-07-03: Require bang-prefixed Mattermost bot commands

- Decision: Mattermost bot commands require `!` on the command word only, for example `!login`, `!status`, and `!chat new`. Slash-prefixed input is rejected with guidance to use `!`, and unprefixed main-conversation messages nudge users toward `!help`.
- Reason: The bot-account UX needs an explicit command marker without becoming a Mattermost slash-command integration. Keeping arguments unprefixed preserves the existing command grammar and examples.
- Consequence: Registered chat-thread replies are the exception: plain text in a known chat thread is treated as AcornOps assistant input without `!`. Documentation and tests must show `!` commands everywhere else.

## 2026-07-03: Use Mattermost threads for multiple concurrent AcornOps chats

- Decision: Replace the single active/paused chat mode with many chat-thread mappings keyed by Mattermost `channel_id + root_id`. `!chat new [title]` creates an AcornOps session and a Mattermost root thread; replies in that thread route to that session, and `!chat end` closes only that thread.
- Reason: Users need to keep normal bot commands available while running more than one investigation. Mattermost threads provide the clearest user-visible container for each AcornOps session.
- Consequence: `!chat pause` and `!chat resume` are retired from the main UX. First implementation restricts a chat thread to the Mattermost user who created it. Assistant replies and SSE follow-ups must include the thread `root_id`.

## 2026-07-03: Persist bot command context in Postgres when configured

- Decision: Add a Postgres-backed command-context store behind `BOT_DATABASE_URL`, covering user context, chat threads, active run records, user-level webhook routes, inbound event idempotency, and schema migrations. Keep the in-memory store as the no-URL local/test fallback.
- Reason: Threaded chats, callback actions, and webhook routing need state that survives normal bot restarts. A database-backed interface also reduces risk before any future multi-replica deployment work.
- Consequence: The bot still avoids storing AcornOps browser sessions, cookies, OIDC tokens, refresh tokens, raw link tokens, or bot-side AcornOps user ids. Active SSE network followers remain process-local while running; persisted active-run records can support later recovery work.

## 2026-07-03: Add one inbound HTTP listener for actions and webhooks

- Decision: Initially add a built-in Node HTTP listener with `GET /healthz`, `POST /mattermost/actions`, and `POST /acornops/webhooks`, configured by `BOT_HTTP_HOST`, `BOT_HTTP_PORT`, `BOT_PUBLIC_BASE_URL`, `MATTERMOST_ACTION_SECRET`, and `ACORNOPS_WEBHOOK_SECRET`.
- Reason: Mattermost interactive messages and AcornOps alerts both need a public callback path. One small listener is enough for the current bot without introducing a web framework.
- Consequence: Superseded later on 2026-07-03 for AcornOps alerts by per-route webhook delivery URLs and removal of `ACORNOPS_WEBHOOK_SECRET`. Docker now exposes the optional bot HTTP port. Any live deployment must make `BOT_PUBLIC_BASE_URL` reachable by Mattermost for actions and by AcornOps for webhook delivery.

## 2026-07-03: Use user-level routes for AcornOps webhook alerts

- Decision: User-level webhook commands are `!webhook connect`, `!webhook status`, and `!webhook disconnect`. Routes map an AcornOps external user id to a Mattermost channel/thread destination owned by that Mattermost user.
- Reason: The user confirmed webhook routing should be user-level, not workspace-level or global. Keeping route management in the bot lets AcornOps deliver signed events and lets the bot decide where each user's alert should appear.
- Consequence: Webhook intake verifies `AcornOps-Timestamp` and `AcornOps-Signature`, deduplicates `AcornOps-Event-Id`, resolves the user route, and posts a concise alert to the stored Mattermost destination. AcornOps-side webhook subscription/registration may still require separate control-plane work.

## 2026-07-01: Package the Mattermost bot as a single-replica Docker image

- Decision: Add Docker image packaging in this repository with `node:22-bookworm-slim`, lockfile-based `npm ci` installs inside Docker, an explicit Docker verification target, and a final runtime image that copies only `src/`, runs as the non-root `node` user, and exposes no port.
- Reason: This repository owns the bot runtime and repo-local validation, so it should be able to produce a verified deployable image without depending on host `node_modules` or local `.env` files. The bot is an outbound Mattermost WebSocket/REST client, not an inbound HTTP service.
- Consequence: Superseded in part on 2026-07-03 by the inbound HTTP listener and Postgres-backed state. `scripts/verify-docker.sh` builds the `verify` target before the final image so `npm run verify:bot` runs inside Linux. The repo-local `docker-compose.yml` is only a developer convenience for running the bot against host-local Mattermost and AcornOps via `host.docker.internal`; full image publishing, secrets templates, and production Compose/Kubernetes orchestration stay in `acornops-deployment`.

## 2026-07-01: Remove CSIT prefixes from active runtime environment names

- Decision: Replace the active Mattermost runtime variables with `MATTERMOST_URL`, `MATTERMOST_BOT_TOKEN`, and `MATTERMOST_BOT_USERNAME`, and use neutral chat timing variables such as `CHAT_RUN_POLL_ATTEMPTS` and `RUN_STREAM_RECONNECT_ATTEMPTS`.
- Reason: This repository is now the official AcornOps Mattermost bot, not a CSIT prototype. Runtime configuration should describe the deployed integration directly.
- Consequence: The previous prefixed Mattermost names are not accepted. Local `.env` files and deployment secrets must use the new names.

## 2026-06-25: Treat this repository as the official AcornOps Mattermost bot integration

- Decision: Reposition the repository from CSIT/local learning to the production-oriented AcornOps Mattermost bot integration.
- Reason: The repository remote is `acornops/mattermost-bot`, the AcornOps external integration contract is implemented, and the user directed that this is part of the official AcornOps offering rather than a learning repo.
- Consequence: README and current-state artifacts should follow the AcornOps multi-repo README pattern: explicit ownership, contract boundary, deployment boundary, production notes, and validation. Historical learning docs may remain for traceability, but new work should treat this as production service code and coordinate cross-repo changes through `acornops-workspace`.

## 2026-06-26: Prefer context-plus-chat mode over explicit assistant session commands

- Decision: The user-facing Mattermost UX should be: choose workspace, choose target, run `chat new`, then ask AcornOps follow-up questions as plain messages while chat mode is active.
- Reason: Explicit `sessions`, `messages`, `ask`, run ids, and session switching make chat history hard for users to reason about. A single active/paused chat pointer per Mattermost user keeps the bot predictable while preserving AcornOps UI access to older sessions.
- Consequence: `help` shows only the common workflow and links to `docs/wiki-mattermost-bot-commands.md` for filters, aliases, shortcuts, and compatibility commands. `targets`/`target 1` become the primary target UX, while `clusters`/`vms`, `sessions`, `messages`, and `ask` stay available outside the short help surface. Chat mode state remains process-local until shared TTL context is introduced.

## 2026-06-29: Treat active chat mode as assistant input except chat controls

- Decision: In active chat mode, normal text and command-looking text such as `status`, `resources`, and `findings` are sent to the AcornOps assistant as user input. The user must send `chat pause` before running normal bot commands. Chat controls such as `chat pause` and `chat end` remain available so the user can leave or clear the mode.
- Reason: After `chat new`, the experience should feel like directly talking to the AcornOps assistant. Letting ordinary commands bypass the assistant makes the mode ambiguous and weakens the user's mental model.
- Consequence: Assistant replies should hide session/message/run ids by default. The bot briefly polls the read-only run and returns the assistant reply when available. If the run is still active, failed, or the reply cannot be loaded within the response window, the bot returns a non-technical status message and keeps the chat context intact. `chat pause` is the explicit transition back to command mode.

## 2026-06-30: Follow long-running chat answers with SSE

- Decision: When a chat-mode question does not complete inside the brief same-response polling window, the Mattermost bot follows `GET /api/v1/runs/{runId}/stream` with external integration service auth and posts the final assistant answer back to the same Mattermost channel.
- Reason: Chat mode should feel like an AcornOps assistant conversation even when read-only runs take longer than Mattermost's immediate response window.
- Consequence: The bot follows only one active streamed run per external user in v1. `chat pause` leaves the stream active and still posts the final answer; `chat end` aborts the stream and suppresses any later result. Stream state is process-local and is lost on bot restart, so multi-replica or restart-resilient deployments still need shared TTL-backed run-following state.

## 2026-06-30: Retire K3s readiness from the active bot harness

- Decision: Remove the repo-local K3s readiness script from the active production bot harness.
- Reason: K3s verification belonged to the completed local learning stage. Current work is the AcornOps Mattermost bot integration, whose standard restart path is harness and bot verification.
- Consequence: K3s notes remain as historical learning traceability, but `./init.sh`, `AGENTS.md`, and current handoff docs no longer direct agents to run a K3s readiness command.

## 2026-05-25: Start with a harness initializer phase

- Decision: Build repository-local harness infrastructure before product feature work.
- Reason: The workspace is empty, so future agent sessions need explicit startup, state, scope, and verification artifacts before implementation starts.
- Consequence: The first verification target checks harness readiness, not application behavior.

## 2026-05-25: Keep `AGENTS.md` short and routing-oriented

- Decision: `AGENTS.md` acts as the entry map, with details split into topic docs.
- Reason: The harness engineering lectures warn that giant instruction files lose signal and bury important constraints.
- Consequence: New durable rules should usually go into focused docs or executable checks, then be linked from `AGENTS.md`.

## 2026-05-25: Use WIP=1 feature tracking

- Decision: `feature_list.json` allows only one active feature at a time.
- Reason: Agents overreach when multiple features are active, which lowers verified completion rate.
- Consequence: Future sessions should finish or block the active item before selecting another.

## 2026-05-26: Build toward a Mattermost ChatOps bot

- Decision: The project direction is a Mattermost ChatOps bot that authenticates Mattermost users to a backend system for managing Kubernetes clusters.
- Reason: The user selected this direction and noted that the backend API will arrive later.
- Consequence: Current work should focus on local K3s learning, local Mattermost setup, and integration discovery before product bot implementation.

## 2026-05-26: Keep host-level setup explicit during learning phase

- Decision: `./init.sh` will not install K3s or start Mattermost automatically yet.
- Reason: K3s installs host-level services and Mattermost local deployment can create persistent Docker state.
- Consequence: Setup docs will provide explicit commands and verification evidence until the local topology is chosen.

## 2026-05-26: Use official Mattermost Docker Compose for first local setup

- Decision: Use the official Mattermost Docker Compose deployment for `L03`, running without the included NGINX reverse proxy for local access at `http://localhost:8065`.
- Reason: Even though the goal is familiarisation, the multi-container deployment is closer to production than the all-in-one preview image because it separates the Mattermost app and database containers.
- Consequence: Setup requires the official `mattermost/docker` checkout, `.env` configuration, local Docker socket access, and Docker Compose lifecycle commands. On Apple Silicon, the Mattermost application container currently needs a local Compose override with `platform: linux/amd64`.

## 2026-05-26: Prototype Mattermost integration with a bot account

- Decision: Use a dedicated Mattermost bot account as the first ChatOps bot integration style. Users should talk to `@acorn-ops-bot` in a direct message or mention it in a channel instead of using a global slash command.
- Reason: The intended experience is a stable assistant-like bot identity, not a command that appears to be available from any chat. A bot account also supports direct-message login prompts, proactive follow-ups, and later Mattermost REST API workflows without using a human admin token.
- Consequence: The next implementation step should create or document the local `acorn-ops-bot` bot account, store its token outside committed files, run a Node.js bot process that listens for Mattermost messages, map the sender `user_id` to the pending backend authentication flow, and ignore messages authored by the bot itself.

## 2026-05-26: Use Node.js built-in runtime APIs for the first bot process

- Decision: Scaffold the first bot process with Node.js ECMAScript modules, built-in runtime APIs, and the built-in `node:test` runner.
- Reason: At the time, the backend API contract was still pending, so the first bot needed verifiable Mattermost message handling more than it needed a larger web framework or dependency stack.
- Consequence: The repository now has dependency-light install, lint, build, test, and local run commands. Revisit Express, Fastify, TypeScript, persistence, and third-party Mattermost client dependencies only when the next feature needs them.

## 2026-06-04: Use AcornOps dev-login only for the first local bot login stage

- Status: superseded by the durable Mattermost account-link contract on 2026-06-09 and the user-id-only request body on 2026-06-10.
- Decision: The first local `login` command uses AcornOps control-plane `POST /api/v1/auth/dev-login` in direct messages only.
- Reason: It exercises the real local backend API and session-cookie response without asking users to type AcornOps passwords into Mattermost. Normal AcornOps user auth is cookie-session based; Bearer tokens are not the browser-user login model.
- Consequence: Superseded by the 2026-06-09 and 2026-06-10 account-link decisions. `dev-login` was a development bridge only and is no longer used for command login.

## 2026-06-04: Use AcornOps OIDC links and shared storage for scalable chat auth

- Status: superseded by the durable Mattermost account-link contract on 2026-06-09.
- Decision: The bot `login` command should generate an AcornOps browser OIDC login link and store only bot-side pending login state until AcornOps exposes a chat-login completion API.
- Reason: AcornOps already owns OIDC and cookie-backed browser sessions. The current control-plane API has no Mattermost callback, no pending-login lookup, and no safe way for the bot to learn the completed browser identity after callback.
- Consequence: Superseded by AcornOps-owned link/resolve endpoints. The bot no longer stores pending login state; AcornOps owns durable Mattermost-to-AcornOps identity links.

## 2026-06-05: Keep chat providers as thin adapters over AcornOps-owned identity

- Status: superseded by `POST /api/v1/auth/chat/integration/link` and `POST /api/v1/auth/chat/integration/resolve`.
- Decision: The Mattermost bot should use an AcornOps-owned chat-login transaction API when available: create the transaction with a service token, let AcornOps complete it after browser OIDC, then poll the transaction and store only AcornOps user metadata plus an opaque chat session token.
- Reason: Current kagent chatbot examples treat Slack/Discord integrations as thin chat adapters that invoke backend agents over A2A while backend runtimes own tools, sessions, observability, and policy. CSIT should follow the same boundary: Mattermost identity stays in the chat adapter; AcornOps identity, authorization, and session issuance stay in AcornOps.
- Consequence: Superseded by the current AcornOps durable account-link contract. The bot uses `EXTERNAL_INTEGRATION_SERVICE_TOKEN`, calls only `link` and `resolve`, and must not receive raw browser cookies or become the source of truth for AcornOps authorization.

## 2026-06-09: Use AcornOps durable Mattermost account-link endpoints

- Decision: Replace the proposed chat-login transaction and polling flow with AcornOps `POST /api/v1/auth/chat/integration/link` for `login` and `POST /api/v1/auth/chat/integration/resolve` for `status`.
- Reason: AcornOps now owns the short-lived Mattermost link token, browser handoff, OIDC/session work, and durable Mattermost-to-AcornOps user link.
- Consequence: The bot no longer stores pending login state, AcornOps browser sessions, OIDC tokens, refresh tokens, raw external chat link tokens, or bot-side AcornOps user ids. The bot authenticates to AcornOps with `EXTERNAL_INTEGRATION_SERVICE_TOKEN`.

## 2026-06-09: Enrich sparse Mattermost direct-message identity through trusted context

- Decision: When direct-message events omit server or team ids, resolve missing values from trusted deployment config and Mattermost REST APIs before calling AcornOps.
- Reason: Live smoke showed Mattermost direct-message events did not provide the full account-link identity context.
- Consequence: Superseded by the 2026-06-10 user-id-only contract below. This fallback was removed from the bot once AcornOps scoped Mattermost linking to a single server with unique user ids.

## 2026-06-10: Scope Mattermost account linking to user id only

- Decision: Remove server/team identity handling from the bot's AcornOps account-link requests and send only the Mattermost post author's `mattermostUserId`.
- Reason: The updated AcornOps contract is scoped to a single Mattermost server where Mattermost user ids are unique across teams.
- Consequence: The bot no longer needs Mattermost server/team config, Mattermost REST context lookups, or multi-team disambiguation for login/status. It still must never accept Mattermost ids typed by users in chat.

## 2026-06-12: Centralize bot runtime defaults and request plumbing

- Decision: Keep runtime defaults in `src/bot/config.js`, including the default Mattermost bot username, and route JSON HTTP behavior for Mattermost and AcornOps through `src/bot/http-client.js`.
- Reason: The bot username and request/error handling were duplicated across small modules, which would make future command work harder to change safely.
- Consequence: Renaming the bot should normally require only `MATTERMOST_BOT_USERNAME` at runtime, with `DEFAULT_MATTERMOST_BOT_USERNAME` as the single code fallback. New service clients should reuse the shared JSON HTTP helper instead of rebuilding fetch, headers, body serialization, and error text.

## 2026-06-17: Use AcornOps generic chat integration endpoint prefix

- Status: superseded by the 2026-06-23 external integration endpoint family.
- Decision: The bot calls AcornOps chat auth through `POST /api/v1/auth/chat/integration/link` and `POST /api/v1/auth/chat/integration/resolve`.
- Reason: AcornOps renamed the endpoint prefix to use a provider-neutral chat integration path while the CSIT adapter still handles Mattermost-specific identity extraction.
- Consequence: Superseded by `/api/v1/auth/external-integrations/*` endpoints.

## 2026-06-18: Use external integration identity names for linking

- Decision: The bot sends the observed Mattermost post author id as `externalUserId` to AcornOps `link` and `resolve`, and uses `EXTERNAL_INTEGRATION_SERVICE_TOKEN` for service authentication.
- Reason: AcornOps now exposes provider-neutral external integration account-link endpoints. The integration client supplies only the external user id; AcornOps owns browser handoff, approval, durable linking, and token security.
- Consequence: The Mattermost adapter remains the source of the external user id, but the AcornOps request body is no longer Mattermost-specific. The legacy `MATTERMOST_CHAT_SERVICE_TOKEN` env name is no longer accepted.

## 2026-06-23: Use AcornOps external integration account-link endpoints

- Decision: The bot now calls `POST /api/v1/auth/external-integrations/link` for `login` and `POST /api/v1/auth/external-integrations/resolve` for `status`.
- Reason: AcornOps moved account-linking out of the chat-auth path into the external integration endpoint family. The installed external integration client id and provider are derived from the bearer token.
- Consequence: Link creation sends the observed Mattermost post author id as `externalUserId` and may include a trusted Mattermost sender name as `externalDisplayName`. Resolve and operational bot calls continue to use only the stable `externalUserId`; operational calls still send `x-acornops-external-user-id`.

## 2026-06-23: Require only EXTERNAL_INTEGRATION_SERVICE_TOKEN

- Decision: Remove the `MATTERMOST_CHAT_SERVICE_TOKEN` runtime fallback and require `EXTERNAL_INTEGRATION_SERVICE_TOKEN` for AcornOps external integration authentication.
- Reason: The AcornOps contract is now provider-neutral, and preserving the older Mattermost-specific token name adds unnecessary configuration ambiguity.
- Consequence: Local `.env` files must use `EXTERNAL_INTEGRATION_SERVICE_TOKEN`; setting only `MATTERMOST_CHAT_SERVICE_TOKEN` leaves AcornOps integration auth unconfigured.

## 2026-06-18: Keep authenticated data-listing commands direct-message-first

- Decision: The first authenticated data command, `/workspaces`, only returns results in direct messages. Channel mentions ask the user to direct-message the bot instead.
- Reason: Workspace names, quotas, and later cluster details can reveal account or infrastructure information. The project does not yet have a channel-safe disclosure policy.
- Consequence: Future authenticated commands should default to direct-message-only unless their response is explicitly designed and reviewed as safe for shared channels. The bot uses the observed Mattermost post author id as `x-acornops-external-user-id` for external integration service-token requests.

## 2026-06-19: Track current workspace in process-local bot context

- Decision: Store the last workspace list and current workspace in a small in-memory context keyed by external user id.
- Reason: AcornOps has no current-workspace concept, but chat users need a simple way to say `/workspace 1` and then `/clusters`. Process-local memory is the smallest useful implementation for the current single-process local bot.
- Consequence: The context stores only workspace ids and display names, not AcornOps sessions or browser credentials. It resets when the bot restarts and is not safe for multi-replica deployments. If the bot becomes multi-replica or needs restart-resilient selection, replace this store with shared TTL storage behind the same command-context interface.

## 2026-06-19: Use plain commands and one selected target

- Decision: Accept bot commands without a leading slash only, keep `login` direct-message-only, and allow authenticated read/read-only assistant commands from direct messages or channel mentions.
- Reason: The Mattermost bot-account experience should be conversational and should not look like a slash-command integration. Non-login commands are explicitly allowed in mentioned channels by the requested command model.
- Consequence: Slash-prefixed commands return guidance to retry without `/`. The process-local command context now tracks current workspace plus exactly one selected target: either a Kubernetes cluster or a VM. Selecting a workspace clears target and session context; selecting a cluster clears VM and session context; selecting a VM clears cluster and session context.
