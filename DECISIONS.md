# Decision Log

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
- Consequence: Renaming the bot should normally require only `CSIT_MATTERMOST_BOT_USERNAME` at runtime, with `DEFAULT_MATTERMOST_BOT_USERNAME` as the single code fallback. New service clients should reuse the shared JSON HTTP helper instead of rebuilding fetch, headers, body serialization, and error text.

## 2026-06-17: Use AcornOps generic chat integration endpoint prefix

- Decision: The bot calls AcornOps chat auth through `POST /api/v1/auth/chat/integration/link` and `POST /api/v1/auth/chat/integration/resolve`.
- Reason: AcornOps renamed the endpoint prefix to use a provider-neutral chat integration path while the CSIT adapter still handles Mattermost-specific identity extraction.
- Consequence: Request-shape tests assert the new URLs. The bot must not accept user-typed Mattermost ids from chat.

## 2026-06-18: Use external integration identity names for linking

- Decision: The bot sends the observed Mattermost post author id as `externalUserId` to AcornOps `link` and `resolve`, and uses `EXTERNAL_INTEGRATION_SERVICE_TOKEN` for service authentication.
- Reason: AcornOps now exposes provider-neutral external integration account-link endpoints. The integration client supplies only the external user id; AcornOps owns browser handoff, approval, durable linking, and token security.
- Consequence: The Mattermost adapter remains the source of the external user id, but the AcornOps request body is no longer Mattermost-specific. The legacy `MATTERMOST_CHAT_SERVICE_TOKEN` env name is accepted only as a local backward-compatible fallback.

## 2026-06-18: Keep authenticated data-listing commands direct-message-first

- Decision: The first authenticated data command, `/workspaces`, only returns results in direct messages. Channel mentions ask the user to direct-message the bot instead.
- Reason: Workspace names, quotas, and later cluster details can reveal account or infrastructure information. The project does not yet have a channel-safe disclosure policy.
- Consequence: Future authenticated commands should default to direct-message-only unless their response is explicitly designed and reviewed as safe for shared channels. The bot uses the observed Mattermost post author id as `x-acornops-external-user-id` for external integration service-token requests.

## 2026-06-19: Track current workspace in process-local bot context

- Decision: Store the last workspace list and current workspace in a small in-memory context keyed by external user id.
- Reason: AcornOps has no current-workspace concept, but chat users need a simple way to say `/workspaces 1` and then `/clusters`. Process-local memory is the smallest useful implementation for the current single-process local bot.
- Consequence: The context stores only workspace ids and display names, not AcornOps sessions or browser credentials. It resets when the bot restarts and is not safe for multi-replica deployments. If the bot becomes multi-replica or needs restart-resilient selection, replace this store with shared TTL storage behind the same command-context interface.
