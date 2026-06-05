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

- Decision: The first local `login` command uses AcornOps control-plane `POST /api/v1/auth/dev-login` in direct messages only.
- Reason: It exercises the real local backend API and session-cookie response without asking users to type AcornOps passwords into Mattermost. Normal AcornOps user auth is cookie-session based; Bearer tokens are not the browser-user login model.
- Consequence: `dev-login` is a development bridge, not the product login flow. The next auth feature should move `login` to an OIDC-backed link flow that maps the authenticated AcornOps user to the Mattermost `user_id`.

## 2026-06-04: Use AcornOps OIDC links and shared storage for scalable chat auth

- Decision: The bot `login` command should generate an AcornOps browser OIDC login link and store only bot-side pending login state until AcornOps exposes a chat-login completion API.
- Reason: AcornOps already owns OIDC and cookie-backed browser sessions. The current control-plane API has no Mattermost callback, no pending-login lookup, and no safe way for the bot to learn the completed browser identity after callback.
- Consequence: The local implementation uses an in-memory store only for development and tests. A scalable deployment should use shared storage: Redis or another TTL-native store for pending login state, and durable database storage for long-lived Mattermost-to-AcornOps identity links. Do not store AcornOps passwords or raw browser session cookies in Mattermost.

## 2026-06-05: Keep chat providers as thin adapters over AcornOps-owned identity

- Decision: The Mattermost bot should use an AcornOps-owned chat-login transaction API when available: create the transaction with a service token, let AcornOps complete it after browser OIDC, then poll the transaction and store only AcornOps user metadata plus an opaque chat session token.
- Reason: Current kagent chatbot examples treat Slack/Discord integrations as thin chat adapters that invoke backend agents over A2A while backend runtimes own tools, sessions, observability, and policy. CSIT should follow the same boundary: Mattermost identity stays in the chat adapter; AcornOps identity, authorization, and session issuance stay in AcornOps.
- Consequence: CSIT now supports `CSIT_ACORNOPS_CHAT_SERVICE_TOKEN` and proposed `/api/v1/auth/chat/mattermost/*` endpoints, but live completion remains blocked until AcornOps implements them. The bot must not receive raw browser cookies or become the source of truth for AcornOps authorization.
