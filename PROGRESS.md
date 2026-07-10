# Project Progress

## Current Verified State

- Repository root directory: `/Users/ryangoh/Desktop/Development/csit`
- Current phase: official AcornOps Mattermost bot integration, production-oriented
- Product direction: Mattermost ChatOps bot for authenticating users to AcornOps through the external integration account-link contract, then exposing AcornOps read and read-only assistant workflows in Mattermost
- Local learning stack: K3s, kubectl, Helm evaluation, local Mattermost via Docker
- Bot implementation stack: Node.js ECMAScript modules with built-in runtime APIs
- First Mattermost integration style: dedicated bot account
- Standard startup path: `./init.sh`
- Standard verification path: `./scripts/verify-harness.sh`
- Mattermost readiness verification path: `./scripts/verify-mattermost.sh`
- Bot verification path: `./scripts/verify-bot.sh`
- Docker image verification path: `./scripts/verify-docker.sh`
- Highest priority unfinished feature: none recorded.
- Current blocker: live Mattermost/AcornOps smoke for the expanded external integration command surface still requires local services.

## Completed

- `H01`: Initialize repository and minimal harness structure.
- `H02`: Choose project direction and initial local learning stack.
- `L01`: Verify local K3s access.
- `L02`: Deploy first K3s learning workload.
- `L03`: Set up local Mattermost.
- `L04`: Explore Mattermost bot integration options.
- `B01`: Choose and scaffold bot implementation runtime.
- `B02`: Wire local Mattermost bot account conversation.
- `B03`: Wire first local AcornOps login command.
- `B04`: Move login to AcornOps external integration account linking.
- `B05`: Wire authenticated workspace command.
- `B06`: Wire authenticated workspace detail and cluster commands.
- `B07`: Wire expanded external integration read and assistant commands.
- `B08`: Redesign Mattermost bot UX around context and chat mode.
- `R01`: Refactor bot command handling modules.
- `D01`: Dockerise the bot runtime image.
- `B09`: Require `!`-prefixed bot commands.
- `B10`: Add Postgres-backed command/chat context and threaded multi-chat routing.
- `B11`: Add one inbound HTTP server for Mattermost actions and AcornOps webhooks.
- `B12`: Add interactive workspace selection for `!workspaces`.
- `B13`: Add user-level AcornOps webhook alert intake and Mattermost posting.
- `B14`: Fix Mattermost actions, Compose database, and webhook route registration UX.
- `B15`: Add Mattermost target selection buttons.
- `B16`: Shorten Mattermost command context and status messages.
- `B17`: Move webhook setup to AcornOps-owned subscription state.
- `B18`: Add workflow listing, launching, and threaded runs.
- `B19`: Enrich AcornOps webhook alert messages.
- `B20`: Validate login-triggered context against AcornOps account changes.

## In Progress

- None.

## Known Issues

- `login` direct messages first call AcornOps `POST /api/v1/auth/external-integrations/resolve`. Already-linked users are told they are linked and `!login reset` is the explicit context reset path. Unlinked or expired users receive a fresh AcornOps account-link URL from `POST /api/v1/auth/external-integrations/link`; bot context is preserved while login completion is pending.
- `!login reset` clears the Mattermost user's workspace, target, session, remembered-list, run, and chat/workflow thread context before returning a fresh account-link URL. Webhook routes are intentionally left untouched.
- After `!login` returns a link URL, the next authenticated command resolves the AcornOps link once. If the linked AcornOps account fingerprint matches the stored hash, context is preserved; if it differs, the bot resets context before running the command and asks the user to choose workspace/target again.
- `status` now calls AcornOps `POST /api/v1/auth/external-integrations/resolve` and reports concise linked/unlinked account state plus current workspace/target names. It intentionally omits the Mattermost user id, backend AcornOps user id, and old chat/session selection line.
- Context-bearing command replies now start with `Current: Workspace: <name>    |    Target: <name>` followed by a divider before the command-specific response body.
- The bot accepts commands with a `!` prefix on the command word only, such as `!login`, `!workspaces`, and `!chat new`. Slash-prefixed commands return guidance to use `!`; unprefixed main-conversation messages nudge users toward `!help`.
- Only `login` is direct-message-only. Authenticated read and read-only assistant commands can run in direct messages or channel mentions.
- `!workspaces` calls AcornOps `GET /api/v1/workspaces?limit=50` with `EXTERNAL_INTEGRATION_SERVICE_TOKEN` and `x-acornops-external-user-id` set to the observed Mattermost post author id.
- `!workspaces` returns numbered workspace rows and, when `BOT_PUBLIC_BASE_URL` is configured, Mattermost workspace selection buttons. Button callbacks verify the action secret and acting Mattermost user before updating the user's current workspace and posting one visible bot result message in the main conversation. Expected action-level failures return Mattermost-compatible HTTP 200 responses to avoid generic integration errors.
- `!workspaces 1` calls `GET /api/v1/workspaces/{workspaceId}` and shows detail without changing the current workspace.
- `!workspace 1` calls `GET /api/v1/workspaces/{workspaceId}`, shows detail, and makes that workspace current for the user.
- `!workspace` shows full details for the current workspace selection.
- `!targets` calls `GET /api/v1/workspaces/{workspaceId}/targets?limit=50` for the current workspace and, when `BOT_PUBLIC_BASE_URL` is configured, returns Mattermost target selection buttons. `!target 1` selects a generic Kubernetes or VM target.
- `!clusters`/`!cluster 1` and `!vms`/`!vm 1` remain compatibility shortcuts for Kubernetes and VM-specific target paths.
- `!resources` and `!findings` use the currently selected target. `!investigations` uses the current workspace.
- `!workflows` lists active read-only workflows for the current workspace. `!workflow run <number|id> [key=value...]` validates declared string inputs, derives exact context grants, supplies selected target bindings, and launches the workflow.
- Accepted workflow launches create a Mattermost root post exactly like `**Workflow launched: Cluster triage**`. Generic run SSE results and plain-text follow-ups stay in that thread and use the same persisted AcornOps workflow session.
- Workflow and chat threads each allow one active run and both close with `!chat end`. The bot does not mutate, schedule, approve, cancel, or run read-write/paused/draft/approval-gated workflows.
- Workflow launch HTTP 400 responses surface AcornOps' safe error code and message. The current local smoke environment returns `AI_PROVIDER_CREDENTIAL_MISSING`; an AI provider API key must be configured in AcornOps AI Settings before a workflow can execute.
- `!chat new [title]` creates a read-only troubleshooting session for the selected target, posts an acknowledgement, then posts a Mattermost root thread such as `Chat #1 - Investigate Pods`.
- Registered chat-thread replies route to the matching AcornOps session by Mattermost `channel_id + root_id` and do not require `!`. Assistant replies and long-running SSE follow-ups are posted with the chat thread `root_id`.
- Chat question `clientMessageId` values are stable per Mattermost post id when available, so websocket retries are idempotent while repeated identical questions in separate Mattermost posts create distinct AcornOps messages/runs.
- If a chat run does not complete inside the brief immediate polling window, the bot follows `GET /api/v1/runs/{runId}/stream` with SSE and posts the final assistant answer back to the same Mattermost thread.
- V1 follows one active streamed run per chat thread. A second question in the same thread is rejected until the active answer completes or the user sends `!chat end` in that thread.
- `!chat pause` and `!chat resume` are retired from the main UX. `!chat end` works inside a chat thread and closes only that chat. `!sessions`, `!session new`, `!session 1`, `!messages`, and `!ask <question>` remain compatibility commands but are no longer shown in the short help.
- `!help` shows the common workflow only. `!help filters` shows supported filter names and finite values. `docs/wiki-mattermost-bot-commands.md` records advanced filters, aliases, shortcuts, and compatibility commands.
- AcornOps moved account-link endpoints on 2026-06-23 to `/auth/external-integrations/`; bot tests now assert the current link and resolve URLs.
- AcornOps updated the account-link contract on 2026-06-18 to require `externalUserId`; the Mattermost adapter supplies the observed post author's Mattermost user id as that external id.
- Bot runtime defaults now live in `src/bot/config.js`; `MATTERMOST_BOT_USERNAME` is the runtime source for changing the bot mention name, with `acorn-ops-bot` as the single code fallback.
- Runtime Mattermost environment variables are `MATTERMOST_URL`, `MATTERMOST_BOT_TOKEN`, and `MATTERMOST_BOT_USERNAME`. The previous prefixed Mattermost names are not accepted.
- Postgres-backed command context is configured with `BOT_DATABASE_URL`; the no-URL fallback remains in-memory for tests and simple local development.
- The inbound HTTP listener is configured with `BOT_HTTP_HOST`, `BOT_HTTP_PORT`, `BOT_PUBLIC_BASE_URL`, and `MATTERMOST_ACTION_SECRET`. It serves `GET /healthz`, `POST /mattermost/actions`, and `POST /acornops/webhooks/routes/:routeToken`. Mattermost Docker deployments that call `host.docker.internal` for local button callbacks must allow that hostname through Mattermost `AllowedUntrustedInternalConnections`.
- `!webhook create`, `!webhook connect`, `!webhook status`, `!webhook recreate`, and `!webhook disconnect` manage one user-level AcornOps alert route to a Mattermost destination. `create` returns the route-token delivery URL to paste into AcornOps console. `connect` claims AcornOps console-created subscription metadata and one-time rotated signing secrets over authenticated external integration APIs. `status` refreshes live AcornOps subscription state, shows AcornOps `unconfigured`/`configured`/`connected` status, guides users to run `!webhook connect` when subscriptions exist without claimed secrets, and falls back to cached state only with a stale warning. Route webhook intake verifies timestamp/signature against claimed subscription secrets, requires and deduplicates event ids, resolves the route token, and posts concise alerts.
- AcornOps webhook posts now render `issue.created.v1`, `issue.reopened.v1`, and `issue.resolved.v1` as rich Mattermost issue alerts with title, bold severity, status, summary, scope/object/reason when present, and relevant issue timestamps. Created and reopened alerts emphasize `lastSeenAt`; resolved alerts emphasize `resolvedAt` and include `lastSeenAt` as supporting context. Alert notices omit ID-only workspace, target, issue, and subject lines. Timestamps render in `BOT_ALERT_TIME_ZONE`, which defaults to `Asia/Singapore`/SGT. Other webhook events still post as generic AcornOps info alerts using `occurredAt`, `createdAt`, `timestamp`, then webhook receive time. The bot defensively collapses repeated adjacent summary sentences before posting.
- `docs/acornops-mattermost-webhook-contract.md` is the AcornOps-facing contract for console setup, connect/status APIs, secret handling, TLS requirements, and signed delivery headers. It now records the AcornOps endpoint contract for exact delivery URL matching, `permissions.manage_webhooks` filtering, connect-time secret rotation, and status values.
- Chat timing environment variables are `CHAT_RUN_POLL_ATTEMPTS`, `CHAT_RUN_POLL_INTERVAL_MS`, `RUN_STREAM_RECONNECT_ATTEMPTS`, `RUN_STREAM_RECONNECT_DELAY_MS`, `RUN_STREAM_FALLBACK_POLL_INTERVAL_MS`, and `RUN_STREAM_FALLBACK_POLL_MAX_MS`.
- Docker image build lives in `Dockerfile`. The image installs dependencies inside Docker from `package*.json`, does not copy host `node_modules`, runs as the non-root `node` user, and exposes the optional bot HTTP port.
- `docker-compose.yml` runs the bot plus a bundled `bot-postgres` service, defaults `BOT_DATABASE_URL` to that database, defaults host-local Mattermost and AcornOps URLs to `http://host.docker.internal:8065` and `http://host.docker.internal:8081`, and defaults `BOT_PUBLIC_BASE_URL` to `http://host.docker.internal:8080`; deployment orchestration still belongs in `acornops-deployment`.
- The most recent live account-link smoke passed after the earlier user-id-only update; the 2026-06-23 external-integrations endpoint move is covered by automated tests but still needs live smoke.
- The bot remembers only lightweight command context: numbered workspaces, targets, clusters, VMs, sessions, current workspace, one selected target, chat-thread mappings, active run pointers, webhook routes, and inbound event ids. It does not store AcornOps browser sessions, cookies, tokens, or link URLs.
- For account-switch detection, the bot stores only a hash of AcornOps `user.id`, a pending-login validation flag, and a context generation number. Mattermost action buttons carry the context generation and stale button callbacks are rejected after resets.
- K3s was a completed local learning stage. Its repo-local readiness script has been removed from the active production bot harness; historical K3s notes remain for traceability.
- Mattermost local setup is documented through the official Docker Compose deployment without NGINX, but the current host readiness probe on 2026-06-30 failed because `localhost:8065` was not listening.
- Mattermost remains an explicit local service; `./init.sh` verifies repo and bot code but does not start Docker Compose.

## Next Steps

1. Run live Mattermost/AcornOps smoke for `!login`, `!status`, `!workspaces`, workspace button selection, `!workspace 1`, `!targets`, target button selection, `!resources`, `!findings`, `!workflows`, `!workflow run 1`, streamed workflow output, a workflow-thread follow-up, thread-local `!chat end`, `!chat new`, a threaded question/reply, concurrent threads, `!webhook create`, AcornOps console setup, `!webhook connect`, `!webhook status`, signed webhook delivery, duplicate suppression, and bot restart persistence when the local stack is available.
2. Add repeatable live-smoke notes for `!` commands, workspace buttons, threaded chats, webhook routing, and signed webhook alert delivery if local service command output becomes available.
3. Coordinate image publishing, environment templates, and orchestration manifests in `acornops-deployment`.
4. Decide whether active run recovery workers are needed after restart now that active run records can be persisted in Postgres.

## Session Log

Session log entries are historical. Superseded risks and decisions are corrected in later entries and in the Current Verified State above.

### 2026-07-10 - Login-triggered context validation

- Goal: Prevent stale Mattermost bot workspace, target, session, and thread context from carrying across an AcornOps account switch without resolving the account on every command.
- Completed: Added hashed AcornOps account fingerprints, a login-validation-pending flag, and context generations to command context. Changed `!login` to resolve first, return an already-linked message for linked users, preserve context while unlinked/expired users complete a new login URL, and support `!login reset` for explicit context clearing. The next authenticated command after a pending login resolves once, preserves context for the same AcornOps user, or resets context before command execution if the fingerprint changed. Context reset removes chat/workflow thread mappings and aborts active run followers for that Mattermost user, while leaving webhook routes untouched. Workspace/target action buttons now carry context generation and stale callbacks are rejected after reset.
- Verification run: Baseline `./init.sh` passed before changes with harness verification, lint, build, and 133 tests. Focused `node --test test/bot-message.test.js test/bot-runner.test.js test/bot-server.test.js test/command-context.test.js test/postgres-store.test.js test/run-follower.test.js` passed with 107 tests. `npm run lint`, `npm run build`, and full `npm test` passed with 139 tests. Final `./init.sh` passed with harness verification, lint, build, and 139 tests.
- Known risks: Same-account expiry relogin and different-account relink still need live smoke against running Mattermost and AcornOps services.

### 2026-07-10 - Rich AcornOps webhook alert formatting

- Goal: Improve signed AcornOps webhook posts so issue lifecycle alerts are informative in Mattermost while non-issue events still route to user chat as generic info alerts.
- Completed: Updated route webhook formatting for `issue.created.v1`, `issue.reopened.v1`, and `issue.resolved.v1` to show Mattermost markdown issue alerts with title, bold severity, status, summary, scope/object/reason when present, and relevant timestamps. Resolved alerts use `resolvedAt` as the primary timestamp because local AcornOps docs/source show `lastSeenAt` is the last observed issue evidence time and `resolvedAt` is set when the issue resolves. Generic events render as `AcornOps info alert` with title and `occurredAt`, `createdAt`, `timestamp`, then webhook received time fallback.
- Verification run: Baseline `./init.sh` passed before changes with harness verification, lint, build, and 131 tests. Focused `node --test test/bot-server.test.js` passed with 13 tests. `npm run verify:bot` passed with lint, build, and 133 tests. Final `./init.sh` passed with harness verification, lint, build, and 133 tests.
- Follow-up: Removed ID-only workspace, target, issue, and subject lines from alert notices; added `BOT_ALERT_TIME_ZONE` with default `Asia/Singapore`; rendered alert times in the configured timezone; and collapsed repeated adjacent summary sentences. The duplicate `Restart count` source was traced to AcornOps control-plane: `snapshot-derived-data.ts` includes restart count in the finding message, and `target-issue-derivation.ts` appends the same restart count when building the issue summary. Focused `node --test test/config.test.js test/bot-server.test.js` passed with 19 tests. `npm run verify:bot` passed with lint, build, and 133 tests.
- Known risks: Live signed webhook delivery and Mattermost rendering still need smoke testing against running local Mattermost and AcornOps services.

### 2026-07-09 - Workflow listing, launching, and threaded runs

- Goal: Add external-integration workflow discovery and read-only launch support, with streamed results and subsequent workflow messages kept in a dedicated Mattermost thread.
- Completed: Added `!workflows` and `!workflow run <number|id> [key=value...]`; quoted string parsing; required/unknown input validation; selected target and cluster bindings; exact unique context-grant derivation; workflow session creation and starter-prompt launch. Added the exact `**Workflow launched: <name>**` root post, workflow-aware persisted thread records, same-session plain-text follow-ups, one active run per thread, shared `!chat end` closure, and workflow terminal output from `run.assistantMessage.content`. Updated help, README, runtime/command docs, decisions, feature tracking, and handoff.
- Verification run: Baseline `./init.sh` passed with 117 tests. Focused workflow/client/message/runner/store/follower tests passed with 104 tests. Manual API reproduction confirmed workflow list returned 200 and session creation returned 201; run creation returned `400 AI_PROVIDER_CREDENTIAL_MISSING`. Added safe workflow 400 reason rendering and regression coverage. Final `./init.sh` passed with harness verification, lint, build, and 131 tests.
- Known risks: A local AcornOps AI provider credential is required to complete the live workflow run smoke. The workflow message contract has no `clientMessageId`, and active SSE followers are not automatically recovered after restart.

### 2026-07-08 - AcornOps webhook route endpoint contract alignment

- Goal: Review AcornOps' new outgoing webhook route endpoint contract and update the bot only where the current implementation diverged.
- Completed: Confirmed the bot already uses `POST /api/v1/external-integrations/webhook-routes/connect` and `GET /api/v1/external-integrations/webhook-routes/status?deliveryUrl=...` with bearer external-integration auth and `x-acornops-external-user-id`. Updated the contract document from proposed wording to the supplied AcornOps contract, including client-token naming, exact delivery URL ownership filtering, `permissions.manage_webhooks`, one-time connect-time signing secret rotation, and `unconfigured`/`configured`/`connected` status semantics. Updated Mattermost `!webhook connect` output to report how many subscription signing secrets were claimed without revealing them. Updated `!webhook status` to guide users when AcornOps reports `configured` subscriptions that still need `!webhook connect` before deliveries can verify.
- Verification run: Baseline `./init.sh` passed before changes with harness verification, lint, build, and 116 tests. Focused `node --test test/acornops-client.test.js test/bot-message.test.js test/bot-server.test.js test/command-context.test.js test/postgres-store.test.js` passed with 89 tests. Full `npm test` passed with 117 tests. Final `./init.sh` passed with harness verification, lint, build, and 117 tests.
- Known risks: Live smoke still needs the local Mattermost and AcornOps services running with AcornOps' new endpoint implementation and console setup UI.

### 2026-07-07 - AcornOps-owned webhook subscription state

- Goal: Implement one Mattermost user webhook route where the bot creates the delivery URL, AcornOps console owns workspace/event subscription configuration, and the bot claims subscription metadata and signing secrets through authenticated AcornOps APIs.
- Completed: Added `docs/acornops-mattermost-webhook-contract.md` for AcornOps review. Added AcornOps client support for proposed `POST /api/v1/external-integrations/webhook-routes/connect` and `GET /api/v1/external-integrations/webhook-routes/status`. Changed `!webhook create` to create/show one delivery URL without exposing secrets, `!webhook connect` to claim subscription metadata and secrets, `!webhook status` to refresh live AcornOps state and warn on cached fallback, and `!webhook recreate` to rotate the route token. Expanded in-memory and Postgres route state with provider, connection status, sync timestamps, last error, and subscription snapshots. Changed signed delivery verification to validate against claimed subscription secrets.
- Verification run: Baseline `./init.sh` passed before changes with harness verification, lint, build, and 113 tests. Focused `node --test test/acornops-client.test.js test/command-context.test.js test/postgres-store.test.js test/bot-server.test.js test/bot-message.test.js` passed with 88 tests after implementation. Full `npm test` passed with 116 tests. Final `./init.sh` passed with harness verification, lint, build, and 116 tests.
- Known risks: Live smoke depends on AcornOps implementing or mapping the contract endpoints. The bot enforces HTTPS for `BOT_PUBLIC_BASE_URL` except local development hostnames; production AcornOps API TLS must also be enforced by deployment/AcornOps contract.

### 2026-07-07 - Short command context and status messages

- Goal: Shorten repeated context blocks in bot replies and remove low-value identifiers from the bot status message.
- Message audit results: Context-bearing commands (`!workspaces`, `!workspace`, `!targets`, `!target`, compatibility cluster/VM commands, `!resources`, `!findings`, `!investigations`, sessions/messages, chat start, and chat status) repeated Mattermost identity and ids before every response. `!status` exposed Mattermost user id, backend AcornOps user id, and an obsolete chat/session line. Error/help guidance also had a few stale bare-command examples even though commands now require `!`.
- Completed: Replaced the shared context block with `Current: Workspace: <name>    |    Target: <name>` plus a divider. Changed `!status` to show account state and current workspace/target only. Updated command guidance to use `!` examples consistently. Kept list/detail object ids where they are still useful for selection, support, or explicit id lookup.
- Verification run: Baseline `./init.sh` passed before changes with harness verification, lint, build, and 113 tests. Focused `node --test test/bot-message.test.js test/bot-runner.test.js` passed with 63 tests after the copy cleanup. Full `npm test` passed with 113 tests. Final `./init.sh` passed with harness verification, lint, build, and 113 tests.
- Known risks: Live Mattermost/AcornOps smoke still needs to confirm the shortened copy reads well in actual Mattermost rendering.

### 2026-07-06 - Target selection buttons

- Goal: Explain the Mattermost interactive button flow, add matching selection buttons for `!targets`, and make workspace/target button callbacks return clear user-facing success or failure messages.
- Completed: Confirmed live Mattermost button failures were caused by Mattermost blocking `host.docker.internal` until `AllowedUntrustedInternalConnections` allowed it. Added target selection button attachments to `!targets` when callback config is present. Extended `POST /mattermost/actions` with `select_target`, preserving user/secret verification and posting one visible bot success or failure message in the main conversation for both workspace and target selection callbacks.
- Verification run: Baseline `./init.sh` passed before changes with harness verification, lint, build, and 108 tests. Focused `node --test test/bot-server.test.js test/bot-message.test.js` passed with 64 tests after initial implementation; focused `node --test test/bot-server.test.js` passed with 11 tests after adding visible callback posts. Final `./init.sh` passed with harness verification, lint, build, and 113 tests.
- Known risks: Live smoke still needs to confirm target button clicks against Mattermost after rebuilding/restarting the bot.

### 2026-07-03 - Smoke-test follow-up for actions, database, and webhooks

- Goal: Fix smoke-test findings: Mattermost workspace buttons produced action integration errors, Docker Compose did not set up the bot database, and the webhook setup was too manual.
- Completed: Changed workspace button payloads to include explicit button type and stable ids. Changed expected Mattermost action failures to return HTTP 200 with structured error messages. Added a bundled Compose `bot-postgres` service with default `BOT_DATABASE_URL` and health dependency. Changed Compose `BOT_PUBLIC_BASE_URL` default to `http://host.docker.internal:8080`. Removed `ACORNOPS_WEBHOOK_SECRET` config and replaced the global `/acornops/webhooks` intake with `POST /acornops/webhooks/routes/:routeToken`. `!webhook connect`/`reconnect` now returns a route-token delivery URL plus per-route signing secret; route webhook delivery requires `AcornOps-Event-Id`, `AcornOps-Timestamp`, and `AcornOps-Signature`.
- Verification run: Baseline `./init.sh` passed before changes with harness verification, lint, build, and 104 tests. Focused `node --test test/bot-server.test.js test/bot-message.test.js test/command-context.test.js test/postgres-store.test.js test/config.test.js` passed with 74 tests after implementation, then focused `node --test test/bot-server.test.js` passed with 7 tests after adding old-endpoint removal coverage. Final `./init.sh` passed with harness verification, lint, build, and 108 tests.
- Known risks: Live smoke still needs to confirm button clicks against Mattermost, Compose Postgres persistence across a bot restart, and signed route-token webhook delivery from the local AcornOps side.

### 2026-07-03 - Mattermost bot UX and alert roadmap

- Goal: Implement the approved roadmap for `!` commands, threaded multi-chat routing, Postgres-backed command context, inbound HTTP callbacks, interactive workspace selection, and user-level AcornOps webhook alerts.
- Completed: Added `!` command parsing while preserving unprefixed arguments and slash rejection; routed registered chat-thread replies by Mattermost `channel_id + root_id`; changed `!chat new [title]` to create an AcornOps session plus an acknowledgement and Mattermost thread root; made `!chat end` thread-local and retired pause/resume from the main UX. Added Postgres-backed state with migrations behind `BOT_DATABASE_URL`, while preserving the in-memory fallback. Added a built-in HTTP listener for `/healthz`, `/mattermost/actions`, and `/acornops/webhooks`. Added workspace selection buttons for `!workspaces`, user verification, and ephemeral confirmations. Added user-level `!webhook connect/status/disconnect`, signed AcornOps webhook validation, event-id dedupe, route resolution, and Mattermost alert posting. Updated Docker/Compose config and command/runtime docs.
- Verification run: Baseline `./init.sh` passed before changes with harness verification, lint, build, and 93 tests. During implementation, `npm test` passed with 104 tests. Final `./init.sh` passed with harness verification, lint, build, and 104 tests.
- Known risks: Live Mattermost/AcornOps smoke still needs to run because local services are not confirmed available. AcornOps-side webhook subscription/registration may need separate control-plane work if external integrations cannot create user-level webhook subscriptions yet. Active SSE network followers are still process-local while running; persisted active-run records do not yet have a restart recovery worker.

### 2026-07-01 - Docker image packaging

- Goal: Rename CSIT-prefixed runtime Mattermost environment variables and add production Docker image packaging for the bot.
- Completed: Renamed runtime config to `MATTERMOST_URL`, `MATTERMOST_BOT_TOKEN`, and `MATTERMOST_BOT_USERNAME`, and renamed active chat timing knobs to non-CSIT names. Added `Dockerfile`, `.dockerignore`, `docker-compose.yml`, and `scripts/verify-docker.sh`. The Docker verifier explicitly builds the `verify` target, which runs `npm run verify:bot` inside `node:22-bookworm-slim`, then builds the final runtime image `acornops-mattermost-bot:local`. The runtime image installs dependencies inside Docker from `package*.json`, copies only `src/` for runtime, runs as the non-root `node` user, and exposes no port. Compose defaults host-local Mattermost and AcornOps URLs to `host.docker.internal`.
- Verification run: Baseline `./init.sh` passed before changes with harness verification, lint, build, and 92 tests. After the env rename, `npm test` passed with 93 tests. Initial forced Docker verification exposed a container portability issue in `test/env.test.js` because it hard-coded `/private/tmp`; the test now uses `os.tmpdir()`. Final `npm test` passed with 93 tests. Final `./scripts/verify-docker.sh` passed: the Docker verify target ran lint, build, and 93 tests inside the image, then the runtime image built as `acornops-mattermost-bot:local`.
- Known risks: Live Mattermost/AcornOps smoke was not run because local services are still not confirmed available. Full deployment wiring, image publishing, and orchestration remain owned by `acornops-deployment`. The bot remains a single-active-replica deployment until shared TTL command context and run-following state are added.

### 2026-06-30 - Bot command module refactor

- Goal: Refactor the oversized bot command message handler into focused modules for readability and maintainability without changing user-facing behavior.
- Completed: Split pure response formatting into `src/bot/commands/formatters.js`, command argument parsing into `src/bot/commands/args.js`, command context into `src/bot/commands/context.js`, AcornOps error-to-user-message handling into `src/bot/commands/errors.js`, chat client-message-id/run polling helpers into `src/bot/chat/runs.js`, and SSE follow-up handling into `src/bot/chat/follower.js`. `src/bot/message.js` now stays focused on command routing and command side effects.
- Verification run: Baseline `./init.sh` passed before the refactor with harness verification, lint, build, and 92 tests. During the refactor, `npm test` passed with 92 tests after the formatter extraction, again after the parser/error/chat-run extraction, and again after moving the helpers into domain folders. Final `./init.sh` passed with harness verification, lint, build, and 92 tests.
- Known risks: This was intentionally structure-only; live Mattermost/AcornOps smoke was not rerun because no runtime behavior was intended to change. `test/bot-message.test.js` remains large and is a good future candidate for splitting by command area.
- Next best action: live-smoke the existing workspace, target, resource, finding, chat-mode, and SSE follow-up flows against the local stack when available.

### 2026-06-30 - K3s readiness removed from active harness

- Goal: Remove the obsolete K3s readiness verifier from the active production bot harness and amend the latest commit message.
- Completed: Deleted the K3s readiness script. Updated `AGENTS.md`, current progress, startup readiness, local environment notes, feature evidence, and handoff docs so K3s is recorded as historical learning traceability rather than an active verification path.
- Verification run: Baseline `./init.sh` passed before the cleanup with harness verification, lint, build, and 92 tests. Final `./init.sh` passed after the cleanup with harness verification, lint, build, and 92 tests.
- Known risks: Historical K3s learning notes still refer to the old `k3d-csit-lab` context and commands for traceability, but no active harness command depends on them.
- Next best action: live-smoke workspace, target, resource, finding, chat-mode, and SSE follow-up flows against the local stack.

### 2026-06-30 - SSE follow-up delivery for chat mode

- Goal: Implement SSE-based follow-up delivery so long-running AcornOps assistant answers are posted back to Mattermost after the immediate response window.
- Completed: Added AcornOps `streamRun()` support for `GET /api/v1/runs/{runId}/stream` with service auth, external user headers, and SSE parsing. Added `src/bot/run-follower.js` to follow one active run per external user, reconnect on dropped SSE streams, fall back to bounded polling, post completed assistant answers, post concise failed/cancelled messages, and suppress stale results after `chat end`. Added active streamed run state to command context. Updated the Mattermost runner so message handling can return follow-up effects after posting the immediate acknowledgement. Preserved fast same-response answers when polling completes quickly. `chat pause` now keeps any active run following in place, while `chat end` aborts it.
- Verification run: Baseline `./init.sh` passed before changes with 79 tests. Focused `node --test test/acornops-client.test.js test/command-context.test.js test/bot-message.test.js test/bot-runner.test.js test/run-follower.test.js` passed with 79 tests. Full `npm test` passed with 91 tests. Final `./init.sh` passed with harness verification, lint, build, and 91 tests.
- Review follow-up: Fixed generic target session routing so `target 1` followed by `chat new` uses `POST /api/v1/workspaces/{workspaceId}/targets/{targetId}/sessions` instead of the compatibility Kubernetes cluster session endpoint. Added command-context source markers and regression coverage for generic Kubernetes target chat sessions. Focused `node --test test/command-context.test.js test/bot-message.test.js test/bot-runner.test.js test/run-follower.test.js test/acornops-client.test.js` passed with 80 tests. Full `npm test` passed with 92 tests. Final `./init.sh` passed with harness verification, lint, build, and 92 tests. Harness/readiness review also ran `./scripts/verify-harness.sh` and `./scripts/verify-mattermost.sh`; harness passed, and Mattermost failed to connect to `localhost:8065`.
- Known risks: Live Mattermost/AcornOps smoke for SSE follow-up delivery still needs to run against local services. Active streamed runs are process-local; if the bot restarts, AcornOps may complete the run but the bot will not post the final answer.
- Next best action: run live smoke for `chat new`, a long-running question that triggers SSE follow-up, a second question while the first is active, `chat pause` followed by a normal command while the answer is still running, and `chat end` suppressing a later result.

### 2026-06-26 - Bot UX redesigned around context and chat mode

- Goal: Implement the approved Mattermost bot UX redesign: concise help, generic targets, visible filter help, and read-only chat mode with pause/resume/end.
- Completed: Added generic `targets` and `target` commands backed by AcornOps target endpoints. Reworked `help` into a short common workflow and added `help filters`. Added `docs/wiki-mattermost-bot-commands.md` for filters, aliases, shortcuts, and compatibility commands. Added `chat new`, `chat pause`, `chat resume`, `chat end`, active chat-mode free-text question handling, latest-run context tracking, and completed-run assistant answer rendering when AcornOps reports completion during the response. Kept `clusters`, `vms`, `sessions`, `session`, `messages`, and `ask` available as compatibility commands outside the short help surface.
- Verification run: Baseline `./init.sh` passed before changes with 65 tests. Focused `node --test test/command-context.test.js test/acornops-client.test.js test/bot-message.test.js` passed with 52 tests. Full `npm test` passed with 72 tests. Final `./init.sh` passed with harness verification, lint, build, and 72 tests.
- Known risks: Live Mattermost/AcornOps smoke for the new target and chat-mode flow still needs to run when the local stack is available. Chat mode context remains process-local, so multi-replica or restart-resilient deployments still need shared TTL context.
- Next best action: live-smoke `login`, `status`, `workspaces`, `workspace 1`, `targets`, `target 1`, `resources`, `findings`, `chat new`, a plain chat question, `chat pause`, `chat resume`, another question, and `chat end`.

### 2026-06-25 - README repositioned for official AcornOps offering

- Goal: Read the AcornOps multi-repo README set, excluding this repository, and update this repository README so it presents as the official production Mattermost bot integration.
- Completed: Reviewed public AcornOps repositories through GitHub: `acornops-workspace`, `control-plane`, `management-console`, `docs-website`, `acornops-deployment`, `execution-engine`, `llm-gateway`, `k8s-agent`, and `vm-agent`; confirmed `acornops/.github` has no README and excluded `mattermost-bot` as this repository. Replaced the old CSIT learning README with an AcornOps-style service README covering status, system role, repository boundaries, contracts, runtime configuration, commands, local development, production notes, docs, and validation. Updated durable repo state to describe this as the official AcornOps Mattermost bot integration rather than a learning repo.
- Verification run: Initial `./init.sh` failed because the harness still required the exact phrase `Mattermost ChatOps bot` in `README.md`; the README was adjusted without changing the verification rule. Final `./init.sh` passed with harness verification, lint, build, and 65 tests.
- Known risks: Several historical docs still contain local-learning background for traceability. Production multi-replica deployment still needs shared TTL command context or a single-active-replica deployment policy.
- Next best action: live-smoke the plain command surface against local Mattermost and AcornOps when the stack is available, then align deployment packaging in `acornops-deployment`.

### 2026-06-23 - External integration endpoint move adopted

- Goal: Merge the authenticated-command branch into `main`, then update CSIT for the latest AcornOps external integration account-link contracts.
- Completed: Fast-forward merged `feat/add-authenticated-commands` into `main`. Updated the AcornOps client to call `POST /api/v1/auth/external-integrations/link` and `POST /api/v1/auth/external-integrations/resolve`. Renamed internal config/client paths toward external-integration terminology. Added optional `externalDisplayName` from trusted Mattermost sender metadata on link creation. Updated tests and durable docs for the new contract. Follow-up cleanup removed the legacy `MATTERMOST_CHAT_SERVICE_TOKEN` runtime fallback; the bot now requires `EXTERNAL_INTEGRATION_SERVICE_TOKEN`.
- Verification run: Targeted `node --test test/acornops-client.test.js test/bot-message.test.js test/bot-runner.test.js test/config.test.js` passed with 52 tests after removing the legacy env fallback. Final `./init.sh` passed with harness verification, lint, build, and 65 tests. Local AcornOps health probe failed to connect to `http://localhost:8081/health`; `./scripts/verify-mattermost.sh` failed to connect to `http://localhost:8065/api/v4/system/ping`.
- Known risks: Live Mattermost/AcornOps smoke for the new `/api/v1/auth/external-integrations/*` link and resolve calls still needs to run when both local services are available.

### 2026-05-25 - Initializer pass

- Goal: Create a minimal harness-first repository baseline.
- Completed: Created `AGENTS.md`, `PROGRESS.md`, `DECISIONS.md`, `feature_list.json`, `init.sh`, `scripts/verify-harness.sh`, and initial docs.
- Verification run: `./init.sh` passed.
- Evidence recorded: harness verification passed on 2026-05-25.
- Commits: initializer baseline commit created.
- Known risks: product direction and stack are not yet encoded.
- Next best action: choose product goal and stack.

### 2026-05-25 - AGENTS.md template hardening

- Goal: Add missing startup, required artifact, definition-of-done, and end-of-session instructions to `AGENTS.md`.
- Completed: Updated `AGENTS.md` to match the provided template more closely while preserving this repo's `PROGRESS.md` naming; added `session-handoff.md`.
- Verification run: `./init.sh` passed.
- Evidence recorded: harness verification passed with AGENTS.md end-of-session checks on 2026-05-25.
- Commits: harness-hardening commit created.
- Known risks: no stack-specific smoke or end-to-end verification exists until the project stack is chosen.
- Next best action: choose product goal and stack.

### 2026-05-26 - Project direction selected

- Goal: Record the project direction and turn the next work into verifiable learning milestones.
- Completed: Documented the Mattermost ChatOps bot direction, K3s-first learning path, local Mattermost setup path, and open bot-runtime decisions.
- Verification run: `./init.sh` passed.
- Evidence recorded: official docs referenced in `docs/project-direction.md` and `docs/local-environment.md`; H02 updated in `feature_list.json`; `./init.sh` passed on 2026-05-26.
- Known risks at the time: K3s and Mattermost had not been installed or verified locally yet; backend API was not available; bot runtime was undecided.
- Next best action: start `L01` by verifying local K3s access.

### 2026-05-26 - Local K3s verified and first workload deployed

- Goal: Verify local K3s access, then deploy and inspect a first learning workload.
- Completed: Installed `k3d` 5.8.3 with Homebrew; created local cluster `csit-lab` with one server and one agent; added a temporary repo-local K3s verifier for the learning stage; deployed `nginx:stable` as `hello-nginx` in namespace `csit-lab`; exposed it as a ClusterIP service; cleaned up the learning namespace.
- Verification run: the temporary K3s verifier passed against kubectl context `k3d-csit-lab`; workload rollout passed with `deployment "hello-nginx" successfully rolled out`; `kubectl get all --namespace csit-lab -o wide` showed pod `1/1 Running`, service `hello-nginx` on `80/TCP`, deployment `1/1 available`; logs showed nginx `Configuration complete; ready for start up`; `kubectl get namespace csit-lab` returned `NotFound` after cleanup; `./init.sh` passed after artifact updates.
- Evidence recorded: K3s nodes `k3d-csit-lab-server-0` and `k3d-csit-lab-agent-0` were `Ready` on K3s `v1.33.6+k3s1`; namespaces `default`, `kube-node-lease`, `kube-public`, and `kube-system` were active.
- Known risks: Docker Desktop must be running for `k3d-csit-lab`; application code and Mattermost are still absent.
- Next best action: start `L03` by setting up local Mattermost.

### 2026-05-26 - Mattermost local setup verified

- Goal: Start `L03` by setting up local Mattermost.
- Completed: Reviewed current official Mattermost docs and selected the official Docker Compose deployment without NGINX for first local familiarisation; cloned `https://github.com/mattermost/docker` to `/private/tmp/mattermost-docker-csit`; configured `.env` for `DOMAIN=localhost` and `MM_SERVICESETTINGS_SITEURL=http://localhost:8065`; added a local Apple Silicon Compose override with `platform: linux/amd64`; started Postgres and Mattermost; added `scripts/verify-mattermost.sh`; created local admin user `csit-admin`, team `csit-lab`, and channel `chatops-lab`.
- Verification run: `./init.sh` passed before starting `L03`; `docker --version` reported Docker version `29.4.3`; first `docker compose -f docker-compose.yml -f docker-compose.without-nginx.yml up -d` failed because `mattermost/mattermost-enterprise-edition:11.7.0` had no matching `linux/arm64/v8` manifest; reran with the Apple Silicon override and Docker Compose started both containers; `docker compose ... ps` showed `mattermost-docker-csit-mattermost-1` `Up ... (healthy)` with `0.0.0.0:8065->8065/tcp` and `mattermost-docker-csit-postgres-1` running; `curl -i http://localhost:8065/api/v4/system/ping` returned `HTTP/1.1 200 OK` and JSON status `OK`; `./scripts/verify-mattermost.sh` passed with host-local access.
- Evidence recorded: local URL is `http://localhost:8065`; Mattermost version header was `11.7.0`; local admin username is `csit-admin`; team `csit-lab` was created with id `bfnj9akc4fytxp4gwbn9ak5cer`; channel `chatops-lab` was created with id `ez1crw7et3fztdsxywargec1sr`.
- Known risks: The Mattermost checkout and data live under `/private/tmp/mattermost-docker-csit`; move to a durable location if the local server should survive temporary-directory cleanup. The Apple Silicon override uses AMD64 emulation, which is acceptable for familiarisation but should be revisited for performance-sensitive testing.
- Next best action: start `L04` by exploring Mattermost bot integration options.

### 2026-05-26 - Mattermost bot integration style selected

- Goal: Start `L04` by exploring Mattermost bot integration options.
- Completed: Reviewed current Mattermost integration docs for custom slash commands, incoming webhooks, outgoing webhooks, bot accounts, REST API use, plugins, and the legacy Apps framework; added `docs/bot-integrations.md`; initially selected a custom slash command before later correcting the direction to a dedicated bot account.
- Verification run: `./init.sh` passed before documentation work; final `./init.sh` passed after artifact updates.
- Evidence recorded: `docs/bot-integrations.md` records tradeoffs, security notes, and official references checked on 2026-05-26. `DECISIONS.md` records the corrected bot-account-first decision.
- Known risks at the time: Backend API contract remained pending; bot implementation runtime was undecided; no local Mattermost bot account existed yet.
- Next best action: start `B01` by choosing and scaffolding the bot implementation runtime.

### 2026-05-26 - Bot runtime scaffolded

- Goal: Start `B01` by choosing and scaffolding the bot implementation runtime around a local Mattermost message handler.
- Completed: Selected Node.js ECMAScript modules with built-in Node.js runtime APIs and `node:test`; added a dependency-light bot scaffold in `src/bot`; added `package.json`, `package-lock.json`, tests, bot lint/build/verify scripts, and `docs/bot-runtime.md`; updated `./init.sh` to include bot verification.
- Verification run: `npm run verify:bot` passed with lint, build, and 9 passing tests; `./init.sh` passed after artifact updates.
- Evidence recorded: bot message handler and Mattermost runner tests pass; tests cover direct-message response selection, mention response selection, self-post ignore behavior, WebSocket authentication challenge handling, Mattermost post creation, help, and status responses.
- Known risks at the time: The local Mattermost `csit` bot account was not wired to a running bot process yet; backend authentication and cluster listing remained placeholders until the backend API contract became available.
- Next best action: start `B02` by configuring the local Mattermost `csit` bot account and recording end-to-end response evidence.

### 2026-05-26 - Integration direction corrected to bot account

- Goal: Correct the next bot wiring task before implementation.
- Completed: Confirmed local Mattermost has zero custom slash commands and no existing `csit` bot account; updated the selected integration direction from custom slash command to dedicated bot account in `docs/bot-integrations.md`, `docs/project-direction.md`, and `DECISIONS.md`.
- Verification run: Mattermost command list checked with `mmctl --local command list csit-lab --json`, which returned zero commands; bot list checked with `mmctl --local bot list --json`, which returned only built-in bots `calls`, `playbooks`, and `system-bot`.
- Known risks: End-to-end `@csit` bot account conversation is not implemented or verified yet.
- Next best action: update the Node bot receiver from slash-command HTTP handling to bot-account message handling, then create the local `csit` bot account and verify a response.

### 2026-05-26 - Mattermost bot account wired end to end

- Goal: Start `B02` by wiring a local Mattermost bot account conversation.
- Completed: Replaced the slash-command HTTP receiver with a bot-account process that authenticates to Mattermost, opens the WebSocket event stream, responds to direct messages and `@csit` mentions, ignores self-authored posts, and posts replies through the Mattermost REST API. Created local bot account `csit` with id `6bcr1d8zxpraxnz77skinxwtoa`; created local test user `csit-alice` with id `rcnutpf7fff4mjthsd1gck5p1y`; confirmed local Mattermost still has zero custom slash commands.
- Verification run: `npm run verify:bot` passed with 12 tests; manual Mattermost bot-account verification passed; final `./init.sh` passed.
- Evidence recorded: Direct-message channel `fqxfhfozojystmibobinn8p94w`; test user post `dof79es14pyy7fnyifteyieiow` sent message `status`; bot reply `o6tjjqjohpg6ikkbrqtxhmx34c` was authored by `csit` and contained `CSIT status`, `Mattermost user: @csit-alice (rcnutpf7fff4mjthsd1gck5p1y)`, `Backend authentication: not connected`, and `Cluster access: not loaded`.
- Known risks: The local bot token was generated for this development Mattermost instance and must stay outside committed files. Backend authentication and cluster listing remain placeholders until the backend API contract is available.
- Next best action: design the backend authentication handoff once the API contract is available, including how direct-message prompts and channel mentions should differ for sensitive actions.

### 2026-05-26 - Bot replies moved out of threads

- Goal: Make bot responses appear as normal Mattermost messages instead of threaded replies.
- Completed: Removed the `root_id` assignment from bot-created posts so responses land in the main direct-message or channel timeline.
- Verification run: `npm run verify:bot` passed with 12 tests; `./init.sh` passed; manual Mattermost direct-message verification passed.
- Evidence recorded: Test user post `n6g8tkb9ypdoiewe3yd87mjqae` sent message `status`; bot reply `4pm7b7i43jyxtgj6g19fs15oby` was authored by `csit`, contained the CSIT status placeholder response, and had `root_id` set to an empty string.
- Known risks: Existing historical test reply `o6tjjqjohpg6ikkbrqtxhmx34c` remains threaded in local Mattermost data because it was created before this change.

### 2026-05-28 - Documentation refreshed for next agent session

- Goal: Review all repository docs and remove deprecated or misleading state before the next agent session.
- Completed: Updated README, startup readiness, harness notes, local environment, project direction, bot integration, bot runtime, AGENTS.md, feature list, and session handoff language to reflect the current bot-account implementation. Added `B03` as the next not-started feature for the backend authentication integration boundary.
- Verification run: `./init.sh` passed; `./scripts/verify-mattermost.sh` passed.
- Evidence recorded: Mattermost readiness check reported `Mattermost is responding at http://localhost:8065` on 2026-05-28. Node.js remained `v25.8.1`, npm remained `11.11.0`, Docker reported `29.4.3`, and k3d reported `v5.8.3` with default K3s `v1.33.6-k3s1`.
- Known risks: `kubectl --context k3d-csit-lab get nodes -o wide` failed on 2026-05-28 because the saved API port refused connections. Restart or recreate the k3d cluster before K3s-dependent work.
- Next best action: start `B03`.

### 2026-06-04 - First local AcornOps login command wired

- Goal: Start the backend-backed command path with `login`, using the real local AcornOps API in stages.
- Completed: Explored `/Users/ryangoh/Desktop/Development/acornops` and confirmed the public backend API is the AcornOps control plane in `/Users/ryangoh/Desktop/Development/acornops/control-plane`, with standalone local URL `http://localhost:8081`. Added `src/bot/acornops-client.js` for `POST /api/v1/auth/dev-login`, `src/bot/auth-store.js` for in-memory session storage keyed by Mattermost `user_id`, and wired direct-message `login` through the bot runner. Channel `login` mentions now ask users to direct-message the bot instead of calling AcornOps. `status` reports a connected AcornOps user when a session is stored.
- Verification run: `./init.sh` passed with 18 tests. Live AcornOps backend smoke passed against `http://localhost:8081`.
- Evidence recorded: Tests cover deterministic Mattermost dev-login email generation, AcornOps dev-login request shape, session-cookie capture, direct-message-only login behavior, status after stored login, and runner-level login wiring. Live smoke evidence: `/health` returned `status=ok`; CSIT `AcornOpsClient.devLogin()` returned `mode=dev`, AcornOps user id `5fa96e56-06d5-4240-827d-9b679505639c`, email `mattermost-live-smoke-user@csit.local`, and a session cookie; command-level `login` plus `status` smoke returned `loginComplete=true` and `statusConnected=true`.
- Known risks: The current login implementation uses AcornOps non-production `dev-login` only; production login should use OIDC identity linking.
- Next best action: start `B04` by replacing the local `dev-login` bridge with an OIDC-backed Mattermost identity link.

### 2026-06-04 - Bad OIDC endpoint assumption removed and bot username corrected

- Goal: Delete the incorrect CSIT-side commit that assumed non-existent AcornOps Mattermost chat-login endpoints, then align the bot username and returned text with `acorn-ops-bot`.
- Completed: Removed commit `f1cafb1 Start OIDC Mattermost login link flow` from the local branch history. Restored the local AcornOps `dev-login` bridge and in-memory `authStore` session behavior. Changed bot defaults, command parsing tests, runner logs, local setup docs, runtime docs, and current source-of-truth notes from the old `csit` bot identity to `acorn-ops-bot`. Updated bot responses from `CSIT commands/status` to `AcornOps bot commands/status`.
- Verification run: `./init.sh` passed with 18 tests after this correction.
- Known risks: The local Mattermost bot account may still be named `csit`; reverify or recreate it as `acorn-ops-bot` before claiming live Mattermost evidence for the new username.
- Next best action: run `./init.sh`, then continue B04 with bot-side pending login/session storage because AcornOps does not expose dedicated Mattermost chat-login endpoints.

### 2026-06-04 - OIDC login link wired with pending chat state

- Goal: Continue `B04` by replacing the local `dev-login` command path with an OIDC-backed browser login link and deciding the scalable session-storage direction.
- Completed: Reviewed the local AcornOps workspace and control-plane API under `/Users/ryangoh/Desktop/Development/acornops/control-plane`. Recorded the route inventory and Mattermost login gap in `docs/acornops-api-inventory.md`. Added `docs/bot-auth-sessions.md` with the decision that in-memory storage is local-only; scalable bot deployments should use shared TTL storage for pending login state and durable database storage for long-lived identity links. Changed `login` direct messages to generate `GET /api/v1/auth/oidc/login` browser links and create pending bot-side login state instead of calling `POST /api/v1/auth/dev-login`.
- Verification run: `npm test` passed with 18 tests after the code change. `./init.sh` passed with 18 tests after artifact updates. Live AcornOps smoke against `http://localhost:8081` passed after rerunning the host-network checks with approval: `/health` returned `status=ok`, `/api/v1/auth/config` returned `oidcEnabled=true` and provider `dex`, `GET /api/v1/auth/oidc/login?return_to=%2Fapi%2Fv1%2Fme` returned `302 Found` to Dex, and command-level `login` plus `status` smoke returned `loginHasOidcLink=true` and `pendingStatus=true`.
- Evidence recorded: Tests cover OIDC login URL generation, direct-message-only login behavior, pending login storage, pending status output, and runner-level login wiring.
- Known risks: Full Mattermost-to-AcornOps identity recognition remains blocked because AcornOps does not expose a chat-login completion endpoint, bot callback, or identity lookup keyed by Mattermost user id. The local Mattermost bot account may still need to be recreated or renamed as `acorn-ops-bot` before live Mattermost evidence is updated.
- Next best action: define and implement the AcornOps chat-login completion API, then replace the local memory store with shared storage for multi-replica bot deployments.

### 2026-06-05 - Bot-side chat-login transaction adapter added

- Goal: Explore whether `B04` can be unblocked from the CSIT side and implement the bot/backend identity tracking boundary that AcornOps can satisfy later.
- Completed: Reviewed the AcornOps control-plane OIDC/session source and current kagent chatbot docs. Added optional AcornOps chat-login client support for `POST /api/v1/auth/chat/integration/login` and `GET /api/v1/auth/chat/integration/login/{id}` with `CSIT_ACORNOPS_CHAT_SERVICE_TOKEN`. Updated the memory auth store to accept backend transaction ids and complete a pending login into a stored AcornOps user/session. Updated `login` to use backend chat transactions when configured, fall back gracefully to the plain OIDC link when the API is unavailable, and updated `status` to refresh completed backend transactions. Documented the proposed AcornOps API contract and kagent-inspired thin-chat-adapter boundary.
- Verification run: `npm test` passed with 23 tests. `./init.sh` passed with harness verification, lint, build, and 23 tests. Local AcornOps live smoke did not run because `curl -fsS http://localhost:8081/health` failed to connect; the control-plane service was not listening.
- Evidence recorded: Tests cover service-token protected chat-login transaction creation, transaction status fetch, backend chat-login command path, graceful fallback when the chat-login endpoint is unavailable, and completing a backend chat-login transaction into stored session state.
- Known risks: `B04` remains blocked for live completion because the AcornOps control plane does not yet expose the proposed `/api/v1/auth/chat/integration/*` endpoints. The CSIT bot stores only an opaque chat session token when completion is reported; AcornOps must define the token's scope, expiry, revocation, and authorization behavior.
- Next best action: implement the AcornOps chat-login endpoints in `/Users/ryangoh/Desktop/Development/acornops/control-plane`, then rerun the local AcornOps smoke and Mattermost bot verification.

### 2026-06-05 - AcornOps contract brief added

- Goal: Check whether the CSIT harness is up to date and generate complete instructions for agents working in AcornOps to build the missing backend contract.
- Completed: Audited `PROGRESS.md`, `feature_list.json`, `DECISIONS.md`, recent commits, startup docs, and handoff state. Added `docs/acornops-chat-login-contract.md`, a detailed AcornOps implementation brief covering the trust boundary, required endpoints, service-token config, Redis transaction state, OIDC callback changes, credential model, durable identity link, tests, verification, and done criteria. Updated README, project direction, harness notes, startup readiness, `init.sh`, feature evidence, and handoff pointers to reference the contract brief instead of vague chat-completion language.
- Verification run: `./init.sh` passed after this documentation update with harness verification, lint, build, and 23 tests.
- Evidence recorded: Harness state was current but improved for discoverability; the next action now points directly to `docs/acornops-chat-login-contract.md`.
- Known risks: AcornOps endpoints are still not implemented; this session produced the implementation instructions, not the AcornOps code.
- Next best action: start a focused AcornOps control-plane task using `docs/acornops-chat-login-contract.md`.

### 2026-06-09 - AcornOps account-link contract wired

- Goal: Replace the placeholder and proposed transaction login/status flow with the AcornOps Mattermost account-link contract.
- Completed: Replaced AcornOps client transaction methods with `createMattermostLink()` for `POST /api/v1/auth/chat/integration/link` and `resolveMattermostLink()` for `POST /api/v1/auth/chat/integration/resolve`. Updated `login` and `/login` to return AcornOps `linkUrl` exactly as provided and tell users the link expires in 10 minutes. Updated `status` and `/status` to ask AcornOps whether the Mattermost identity is durably linked. Removed the old in-memory `auth-store.js` pending/session store from runtime. Threaded Mattermost server, team, and user ids from WebSocket event context into bot commands and refused AcornOps calls when required identity fields are missing.
- Verification run: `npm test` passed with 21 tests after the contract swap. `./init.sh` passed after artifact updates with harness verification, lint, build, and 21 tests. Live smoke did not run because `curl -fsS http://localhost:8081/health` failed to connect and `./scripts/verify-mattermost.sh` failed to connect to `http://localhost:8065/api/v4/system/ping`.
- Evidence recorded: Tests cover service-token protected `link` and `resolve` request shape, exact returned account-link URL behavior, slash-style command aliases, direct-message-only login guard, linked and unlinked status handling, and ignoring user-supplied post props for Mattermost identity extraction.
- Known risks: Live AcornOps/Mattermost smoke has not run yet because both local services were offline. Local Mattermost direct-message events may not expose the required server and team ids in the fields currently extracted by `src/bot/runner.js`.
- Next best action: run `./init.sh`, then live-smoke the account-link flow with local Mattermost and AcornOps.

### 2026-06-09 - Sparse Mattermost identity context fallback added

- Goal: Fix live smoke failure where `login` and `status` could not call AcornOps because Mattermost direct-message events lacked server/team identity context.
- Completed: Added Mattermost client methods for `GET /api/v4/config/client`, `GET /api/v4/channels/{id}`, and `GET /api/v4/users/{id}/teams`. Updated the runner to resolve identity from event context, optional trusted deployment defaults, Mattermost server config, channel team context, and exactly-one user team fallback. Added `.env.local` / `.env` loading and created an ignored local `.env` for runtime values. The bot still refuses to guess if the team remains ambiguous.
- Verification run: `npm test` passed with 27 tests after the fix. `./init.sh` passed with harness verification, lint, build, and 27 tests after the env-loader artifact updates. Live smoke did not run from this workspace because AcornOps was not listening on `localhost:8081` and Mattermost was not listening on `localhost:8065`.
- Evidence recorded: Tests cover sparse direct-message identity enrichment, configured default precedence, no guessing for multi-team users, Mattermost context API request shapes, and `.env` loading without overriding existing process env.
- Known risks: Live Mattermost/AcornOps smoke still needs to be rerun after the context fallback.
- Next best action: run `./init.sh`, then ask the user to rerun the live smoke.

### 2026-06-10 - Account-link contract scoped to Mattermost user id

- Goal: Update the bot to the revised AcornOps account-link contract, which requires only `mattermostUserId`.
- Completed: Removed server/team identity requirements from login/status request bodies. Removed Mattermost server/team env defaults and REST context lookups. Kept automatic `.env.local` / `.env` loading for local tokens and API URLs. Added friendly login/status configuration responses when `MATTERMOST_CHAT_SERVICE_TOKEN` is missing. Updated tests and docs to reflect the single-server, user-id-only contract.
- Verification run: `npm test` passed with 24 tests after the user-id-only update. `./init.sh` passed with harness verification, lint, build, and 24 tests.
- Known risks: Live Mattermost/AcornOps smoke still needs to run. `curl -fsS http://localhost:8081/health` and `./scripts/verify-mattermost.sh` both failed to connect from this workspace because the local services were not listening.
- Next best action: start local AcornOps and Mattermost, then live-smoke `login` and `status`.

### 2026-06-10 - Account-link live smoke passed and harness refreshed

- Goal: Clear deprecated harness/docs references after the user verified the updated `login` and `status` flow locally.
- Completed: Recorded the live-smoke result, marked `B04` complete, updated current next actions away from account-link smoke, and replaced the historical proposed chat-login transaction section with the current link/resolve contract.
- Verification run: User reported the updated Mattermost `login` and `status` flow works. `./init.sh` passed after the docs cleanup with harness verification, lint, build, and 24 tests.
- Known risks: The exact Mattermost post ids and AcornOps response snippets from the live smoke were not captured in this repository. Cluster listing remains a placeholder.
- Next best action: start `B05` for authenticated cluster commands.

### 2026-06-12 - Pre-B05 bot refactor

- Goal: Reduce bot technical debt before starting authenticated cluster command work.
- Completed: Added `src/bot/http-client.js` so Mattermost and AcornOps clients share base URL trimming, JSON body serialization, raw-response support, and API error text. Added `src/bot/config.js` so runtime defaults and `MATTERMOST_BOT_USERNAME` handling are centralized. Added `src/bot/message-utils.js` for command parsing, mention parsing, regex escaping, and user labels. Kept the current account-link behavior unchanged and kept `B05` not started.
- Verification run: `npm test` passed with 31 tests. `npm run lint` passed. `./init.sh` passed with harness verification, lint, build, and 31 tests.
- Known risks: No live Mattermost or AcornOps smoke was run for this refactor because it is internal code organization; the automated account-link and runner tests still cover request shapes and message behavior.
- Next best action: start `B05` for authenticated cluster commands.

### 2026-06-17 - Chat auth endpoint prefix renamed

- Goal: Align CSIT with the renamed AcornOps chat integration endpoints.
- Completed: Updated the AcornOps bot client to call `POST /api/v1/auth/chat/integration/link` and `POST /api/v1/auth/chat/integration/resolve` instead of the old Mattermost-specific path prefix. Updated automated request-shape tests and current repo docs/handoff references.
- Verification run: `node --test test/acornops-client.test.js` passed with 3 tests. `./init.sh` passed after the rename with harness verification, lint, build, and 31 tests.
- Known risks: No live Mattermost or AcornOps smoke was run for the rename in this workspace; automated tests cover the request URLs.
- Next best action: run `./init.sh`, then continue to `B05` once the local stack is ready.

### 2026-06-18 - Authenticated workspace command wired

- Goal: Start authenticated backend commands by wiring `/workspaces` to the provided AcornOps `GET /api/v1/workspaces` endpoint.
- Completed: Created branch `feat/add-authenticated-commands`. Added `AcornOpsClient.listWorkspaces()` using the external integration service token and `x-acornops-external-user-id` set from the observed Mattermost post author. Added direct-message-only `/workspaces` command handling with no-argument validation, workspace name/plan/quota formatting, empty-state handling, next-cursor display, unlinked 401 guidance, and backend-error handling that avoids echoing response bodies. Updated feature tracking so `B05` is the workspace command and cluster command work remains tracked as `B06`.
- Verification run: Baseline `./init.sh` passed before work with 31 tests. Targeted tests passed after implementation: `node --test test/acornops-client.test.js` with 4 tests, `node --test test/bot-message.test.js` with 19 tests, and `node --test test/bot-runner.test.js` with 7 tests. Final `./init.sh` passed with harness verification, lint, build, and 40 tests.
- Known risks: Live Mattermost/AcornOps smoke did not run because Mattermost was not listening on `localhost:8065` and AcornOps was not listening on `localhost:8081`. `/workspaces` is intentionally direct-message-only until a channel-safe workspace disclosure policy exists.
- Next best action: live-smoke `/workspaces` against the local stack when available, then start `B06`.

### 2026-06-18 - External integration link contract names adopted

- Goal: Update the bot to the AcornOps external integration account-link contract.
- Completed: Changed link and resolve request bodies from Mattermost-specific `mattermostUserId` to provider-neutral `externalUserId`, sourced only from the observed Mattermost post author id. Updated the workspace external-user header to use the same normalized id. Switched runtime configuration and user-facing setup text to `EXTERNAL_INTEGRATION_SERVICE_TOKEN`, while retaining `MATTERMOST_CHAT_SERVICE_TOKEN` as a backward-compatible local fallback. Updated tests, contract docs, API inventory, decisions, runtime notes, and handoff state.
- Verification run: Baseline `./init.sh` initially failed with 10 tests because `external identity helper` built `externalUserId` but still validated `mattermostUserId`. Targeted verification passed after the fix: `node --test test/acornops-client.test.js test/bot-message.test.js test/bot-runner.test.js test/config.test.js` passed with 33 tests. Final `./init.sh` passed with harness verification, lint, build, and 41 tests.
- Known risks: Live Mattermost/AcornOps smoke was not run in this workspace; automated tests cover the request body, token env selection, and trusted post-author extraction.
- Next best action: live-smoke `/workspaces` against the local stack when available, then start `B06`.

### 2026-06-19 - Workspace context and cluster commands wired

- Goal: Add workspace detail, current workspace tracking, and cluster listing commands using the new AcornOps external integration endpoints.
- Completed: Added `AcornOpsClient.getWorkspace()` for `GET /api/v1/workspaces/{workspaceId}` and `AcornOpsClient.listKubernetesClusters()` for `GET /api/v1/workspaces/{workspaceId}/kubernetes-clusters?limit=50`. Added process-local per-external-user command context that stores the last numbered workspace list and current workspace. Updated `/workspaces` to return numbered rows, added `/workspaces 1` and `/workspace 1` for workspace detail and selection, added `/workspace` for current selection, and wired `/clusters` plus `/clusters 1` to the AcornOps cluster endpoint. Refactored authenticated data-command setup and formatting to reduce duplication for future commands.
- Verification run: Baseline `./init.sh` passed before work with 41 tests. Targeted tests passed after implementation: `node --test test/acornops-client.test.js` with 6 tests, `node --test test/command-context.test.js` with 3 tests, `node --test test/bot-message.test.js` with 24 tests, and `node --test test/bot-runner.test.js` with 8 tests. Final `./init.sh` passed with harness verification, lint, build, and 52 tests.
- Known risks: Live Mattermost/AcornOps smoke did not run because Mattermost was not listening on `localhost:8065` and AcornOps was not listening on `localhost:8081`. The current workspace context is process-local and will reset on bot restart; use shared TTL storage later if multi-replica or restart-resilient command context becomes necessary.
- Next best action: live-smoke `/workspaces`, `/workspaces 1`, `/workspace`, and `/clusters` when the local stack is available.

### 2026-06-19 - Workspace detail commands clarified

- Goal: Make `workspaces 1` read-only and make `workspace` show full current-workspace details.
- Completed: Changed `workspaces 1` so it fetches and displays workspace detail without updating current workspace. Kept `workspace 1` as the explicit current-workspace selection command. Changed `workspace` to call `GET /api/v1/workspaces/{workspaceId}` and render the same detail shape for the current workspace.
- Verification run: Baseline `./init.sh` passed before work with 52 tests. Targeted tests passed after the behavior change: `node --test test/bot-message.test.js` passed with 25 tests and `node --test test/bot-runner.test.js` passed with 8 tests. Final `./init.sh` passed with harness verification, lint, build, and 53 tests.
- Known risks: Live Mattermost/AcornOps smoke still has not run in this workspace because the local services are not available here.
- Next best action: live-smoke `/workspaces`, `/workspaces 1`, `/workspace 1`, `/workspace`, and `/clusters` when the local stack is available.

### 2026-06-19 - Expanded external integration command surface wired

- Goal: Implement the updated bot command plan from the external integration endpoint contract.
- Completed: Changed command parsing so only commands without a leading slash are accepted. Kept `login` direct-message-only and allowed other authenticated read/read-only assistant commands from direct messages or channel mentions. Added AcornOps client support for cluster detail, cluster resources, cluster findings, workspace investigations, VMs, VM resources/findings, target sessions, session metadata/messages, read-only assistant message posting, and run lookup. Expanded process-local command context to track numbered clusters, VMs, and sessions; current workspace; exactly one selected target; and current session. Selecting a workspace clears target/session context, and selecting a cluster or VM clears the other target plus session. Added `cluster`, `resources`, `findings`, `investigations`, `vms`, `vm`, `sessions`, `session new`, `session`, `messages`, and `ask`.
- Verification run: Focused verification passed with `node --test test/acornops-client.test.js test/command-context.test.js test/bot-message.test.js` reporting 45 passing tests. Final `./init.sh` passed with harness verification, lint, build, and 64 tests.
- Known risks: Live Mattermost/AcornOps smoke still has not run in this workspace because the local services are not available here. Assistant run observation beyond returning the run id is not yet user-facing.
- Next best action: live-smoke the plain command surface against local Mattermost and AcornOps when the stack is available.

### 2026-06-26 - Chat-mode question 400 and UX copy follow-up

- Goal: Fix the live `chat new` then free-text question failure and remove stale command copy from the context-plus-chat UX.
- Completed: Changed chat-mode question posting to generate an identifier-like `clientMessageId` from hashed Mattermost user, session, and question values instead of using a raw `externalUserId:hash` string. Added a clearer 400 response for rejected chat messages. Updated workspace, cluster shortcut, VM shortcut, resource, and finding responses to reinforce the generic `targets` and `chat new` flow instead of old cluster/VM session wording.
- Verification run: `node --test test/bot-message.test.js` passed with 38 tests. Final `./init.sh` passed with harness verification, lint, build, and 72 tests.
- Known risks: Live Mattermost/AcornOps smoke still needs to rerun to confirm the AcornOps backend now accepts the updated chat message payload.
- Next best action: live-smoke `chat new`, a free-text question, `resources`, `chat pause`, `chat resume`, another question, and `chat end` against the local stack.

### 2026-06-29 - Chat-mode 400 reason surfaced

- Goal: Continue the live `chat new` then free-text question investigation after the sanitized `clientMessageId` still produced an AcornOps HTTP 400.
- Completed: Re-read the external integration bot endpoint contract and confirmed the documented message body remains `content`, `toolAccessMode: "read_only"`, and `clientMessageId`. Added parsing for structured AcornOps error responses embedded in failed HTTP errors, and changed chat-message 400 handling to show a safe AcornOps error code/message instead of incorrectly suggesting that the user rephrase the question. Added regression coverage for structured chat 400 responses such as `AI_PROVIDER_NOT_CONFIGURED`.
- Verification run: Baseline `./init.sh` passed before the change with 72 tests. Focused `node --test test/bot-message.test.js` passed with 39 tests. Final `./init.sh` passed with harness verification, lint, build, and 73 tests.
- Known risks: Local AcornOps and Mattermost were not listening on `localhost:8081` or `localhost:8065` from this workspace, so the live chat question could not be reproduced here. The next live attempt should now reveal whether the 400 is validation, AI provider configuration, ownership/session scope, or another AcornOps-side reason.
- Next best action: rerun the live `chat new` plus free-text question smoke and capture the new AcornOps error code/message shown by the bot.

### 2026-06-29 - Chat-mode response UX made conversational

- Goal: Replace the run-submission response after `chat new` with a conversational chat-mode response that feels like directly talking to the AcornOps assistant.
- Completed: Kept chat context intact after `chat new`. Changed chat question handling to poll the read-only run briefly, return the assistant reply directly when available, and hide session/message/run ids by default. Added a non-technical "still working" fallback when the run remains active after the response window. Made active chat mode modal: command-looking text such as `status`, `resources`, and `findings` is sent to the assistant until the user sends `chat pause`; chat controls such as `chat pause` and `chat end` remain available. Added tests for polling through `dispatching` to completion, hiding run details while still active, treating `status` and `resources` as assistant input while chat is active, and running commands after `chat pause`. Updated runtime and wiki docs to describe polling and the revised pause semantics.
- Verification run: Focused `node --test test/bot-message.test.js` passed with 44 tests. Final `./init.sh` passed with harness verification, lint, build, and 78 tests after tightening active chat mode so command-looking text is assistant input until `chat pause`.
- Known risks: The bot does not use SSE or proactive follow-up posts yet; it polls within the current Mattermost response window and falls back if the AcornOps run is still active.
- Next best action: live-smoke `chat new`, a free-text question that completes quickly, a longer-running question that exercises the fallback, `status` while chat mode is active, and `chat end`.

### 2026-06-29 - Review fixes for chat idempotency and command docs link

- Goal: Address review findings for chat `clientMessageId` reuse, assistant reply correlation, and the missing local command-reference doc.
- Completed: Threaded the Mattermost source post id from the WebSocket runner into chat question handling and now derives `clientMessageId` from that post id only. This keeps retries of the same Mattermost post idempotent while allowing repeated identical questions in separate Mattermost posts. Tightened completed-run answer rendering so the run must correlate to the accepted user `message_id`, and assistant session-message fallback now requires the exact run id instead of accepting untagged assistant rows. Updated repo docs and artifacts to point to `docs/wiki-mattermost-bot-commands.md`.
- Verification run: Focused `node --test test/bot-message.test.js test/bot-runner.test.js` passed with 54 tests. Final `./init.sh` passed with harness verification, lint, build, and 80 tests.
- Known risks: Live Mattermost/AcornOps smoke still needs to rerun for the context-plus-chat path.
- Next best action: live-smoke `chat new`, repeated identical questions in separate Mattermost posts, completed-run assistant replies, and `chat pause`/`chat resume` against the local stack.

### 2026-06-30 - Message identity path simplified

- Goal: Remove duplicate Mattermost identity wiring from the Mattermost runner and message handler.
- Completed: Stopped constructing a separate identity object in `src/bot/runner.js`; the runner now passes the observed `post.user_id` once as `userId`. `src/bot/message.js` no longer accepts a compatibility identity parameter and derives `{ externalUserId }` directly from `userId`. Removed the runner-only identity helper and renamed test helpers to the provider-neutral external identity shape.
- Verification run: Focused `node --test test/bot-message.test.js test/bot-runner.test.js test/acornops-client.test.js` passed with 61 tests. Final `./init.sh` passed with harness verification, lint, build, and 79 tests.
- Known risks: None beyond the existing live-smoke gap for the context-plus-chat path.
