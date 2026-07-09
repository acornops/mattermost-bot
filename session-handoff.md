# Session Handoff

## Currently Verified

- Current implementation includes rich AcornOps webhook alert formatting: `issue.created.v1`, `issue.reopened.v1`, and `issue.resolved.v1` render as Mattermost issue alerts with title, bold severity, summary, and issue timestamps. Resolved alerts use `resolvedAt` as the primary timestamp because AcornOps source shows `lastSeenAt` is evidence last observed; generic events still post as AcornOps info alerts using `occurredAt`, `createdAt`, `timestamp`, then receive time. Final `./init.sh` passed on 2026-07-10 with 133 tests.
- Current implementation includes workflow discovery and threaded execution: `!workflows` lists active read-only workflows, `!workflow run <number|id> [key=value...]` validates inputs and target bindings, and accepted runs create `**Workflow launched: <name>**` roots whose SSE output and follow-ups stay in the same persisted AcornOps workflow session. A smoke follow-up proved list/session requests succeed and identified missing AcornOps AI credentials as the run blocker; safe workflow 400 reasons are now shown to users. Final `./init.sh` passed on 2026-07-09 with 131 tests.
- The Mattermost bot UX and alert roadmap also remains in place: `!` commands, threaded multi-chat routing, Compose-bundled Postgres state, inbound HTTP callbacks, `!workspaces` and `!targets` selection buttons, AcornOps-owned webhook subscription state behind one Mattermost user delivery URL, and concise command context/status messages.
- Docker image verification passed on 2026-07-01: `./scripts/verify-docker.sh` built the `verify` target, ran `npm run verify:bot` inside `node:22-bookworm-slim` with 93 passing tests, then built `acornops-mattermost-bot:local`.
- `npm test` passed on 2026-07-01 with 93 tests after renaming runtime env vars and adding Docker packaging.
- Final `./init.sh` passed after the bot command module refactor and domain-folder follow-up, with harness verification, lint, build, and 92 tests. `npm test` also passed with 92 tests during the refactor and after the folder move.
- Final review verification after the generic target session-routing fix passed: focused `node --test test/command-context.test.js test/bot-message.test.js test/bot-runner.test.js test/run-follower.test.js test/acornops-client.test.js` with 80 tests, full `npm test` with 92 tests, and final `./init.sh` with harness verification, lint, build, and 92 tests.
- Final `./init.sh` passed after removing the obsolete K3s readiness script from the active harness, with harness verification, lint, build, and 92 tests.
- Final `./init.sh` passed after SSE follow-up delivery with harness verification, lint, build, and 91 tests. Full `npm test` passed with 91 tests. Focused `node --test test/acornops-client.test.js test/command-context.test.js test/bot-message.test.js test/bot-runner.test.js test/run-follower.test.js` passed with 79 tests.
- Final `./init.sh` passed after simplifying the message identity path, with harness verification, lint, build, and 79 tests. Focused `node --test test/bot-message.test.js test/bot-runner.test.js test/acornops-client.test.js` also passed with 61 tests.
- Final `./init.sh` passed after chat idempotency/reply-correlation review fixes and command-doc link cleanup, with harness verification, lint, build, and 80 tests.
- Final `./init.sh` passed after tightening active chat mode so command-looking text is assistant input until `chat pause`, with harness verification, lint, build, and 78 tests.
- Final `./init.sh` passed after the June 29 conversational chat-mode response follow-up with harness verification, lint, build, and 76 tests.
- Final `./init.sh` passed after the June 29 chat-mode 400 reason-surfacing follow-up with harness verification, lint, build, and 73 tests.
- Final `./init.sh` passed after the June 26 chat-mode question payload and UX copy follow-up with harness verification, lint, build, and 72 tests.
- Final `./init.sh` passed after the June 25 README production repositioning with harness verification, lint, build, and 65 tests.
- Final `./init.sh` passed after the June 26 context-plus-chat UX redesign with harness verification, lint, build, and 72 tests.
- This repository is now documented as the official AcornOps Mattermost bot integration, not a CSIT learning repository.
- Final `./init.sh` passed after the June 19 expanded external integration command work with harness verification, lint, build, and 64 tests.
- Targeted tests passed after the June 23 external integration endpoint update: `node --test test/acornops-client.test.js test/bot-message.test.js test/bot-runner.test.js test/config.test.js` with 51 tests.
- Final `./init.sh` passed after the June 23 external integration endpoint update with harness verification, lint, build, and 64 tests.
- Targeted tests passed after removing `MATTERMOST_CHAT_SERVICE_TOKEN` fallback: `node --test test/acornops-client.test.js test/bot-message.test.js test/bot-runner.test.js test/config.test.js` with 52 tests.
- Final `./init.sh` passed after removing the fallback with harness verification, lint, build, and 65 tests.
- Final `./init.sh` passed after the June 19 workspace-detail behavior clarification with harness verification, lint, build, and 53 tests.
- Final `./init.sh` passed after the June 19 workspace-context and cluster-command work with harness verification, lint, build, and 52 tests.
- Final `./init.sh` passed after the June 18 external integration contract update with harness verification, lint, build, and 41 tests.
- Baseline `./init.sh` passed before the June 19 workspace-context and cluster-command work with harness verification, lint, build, and 41 tests.
- Targeted workspace-context and cluster-command tests passed after implementation: `node --test test/acornops-client.test.js` with 6 tests, `node --test test/command-context.test.js` with 3 tests, `node --test test/bot-message.test.js` with 24 tests, and `node --test test/bot-runner.test.js` with 8 tests.
- Baseline `./init.sh` passed before the June 18 workspace-command work with harness verification, lint, build, and 31 tests.
- Targeted workspace-command tests passed after implementation: `node --test test/acornops-client.test.js` with 4 tests, `node --test test/bot-message.test.js` with 19 tests, and `node --test test/bot-runner.test.js` with 7 tests.
- `./scripts/verify-harness.sh` passes.
- Product direction is selected: Mattermost ChatOps bot for authenticating users to AcornOps, a Kubernetes cluster-management backend.
- Local Mattermost is documented through the official Docker Compose deployment without NGINX at `http://localhost:8065`, but the 2026-06-30 readiness probe failed because nothing was listening on that port.
- K3s was a historical learning stage only. The active production bot harness no longer includes a K3s readiness script.
- First Mattermost integration style is selected: dedicated bot account `@acorn-ops-bot`.
- Bot implementation runtime is Node.js ECMAScript modules with built-in runtime APIs.
- The bot responds to Mattermost direct messages and channel mentions through REST plus WebSocket events.
- The bot accepts commands with `!` on the command word only, for example `!login`, `!workspaces`, and `!chat new`. Slash-prefixed commands return guidance to use `!`; unprefixed main-conversation messages nudge users toward `!help`.
- `login` in direct messages calls AcornOps `POST /api/v1/auth/external-integrations/link` with `{ "externalUserId": "<post author user_id>", "externalDisplayName": "<sender name when available>" }`.
- `status` calls AcornOps `POST /api/v1/auth/external-integrations/resolve` with the same external user id.
- Context-bearing bot replies now start with `Current: Workspace: <name>    |    Target: <name>` followed by a divider. `!status` intentionally omits Mattermost user ids, backend AcornOps user ids, and chat/session selection.
- Only `login` is direct-message-only. Authenticated read and read-only assistant commands can run in direct messages or channel mentions.
- `!workspaces` calls AcornOps `GET /api/v1/workspaces?limit=50` using `EXTERNAL_INTEGRATION_SERVICE_TOKEN` and `x-acornops-external-user-id` set to the observed Mattermost post author id. It returns numbered rows, remembers lightweight `{ id, name }` references per external user id, and attaches workspace selection buttons when `BOT_PUBLIC_BASE_URL` is configured.
- `!workspaces 1` calls `GET /api/v1/workspaces/{workspaceId}` and shows detail without changing the current workspace.
- `!workspace 1` calls `GET /api/v1/workspaces/{workspaceId}`, shows detail, makes that workspace current, and clears current target/session context.
- `!workspace` calls `GET /api/v1/workspaces/{workspaceId}` and shows full details for the current workspace.
- `!targets` calls `GET /api/v1/workspaces/{workspaceId}/targets?limit=50` for the current workspace, remembers lightweight target references, and attaches target selection buttons when `BOT_PUBLIC_BASE_URL` is configured; `!target 1` selects a generic Kubernetes or VM target.
- `!clusters`/`!cluster 1` and `!vms`/`!vm 1` remain compatibility shortcuts for Kubernetes and VM-specific target paths.
- `!resources` and `!findings` use the currently selected target. `!investigations` uses the current workspace.
- `!chat new [title]` creates a read-only troubleshooting session for the selected target, posts an acknowledgement, then posts a Mattermost root thread. Replies in that thread route to the matching AcornOps session without requiring `!`.
- `!workflows` lists active read-only workflows for the current workspace. `!workflow run <number|id> [key=value...]` launches one with exact context grants and selected target bindings, creates a dedicated root, and streams final output there. Plain replies continue the same workflow session.
- Long-running chat answers are followed over AcornOps SSE through `GET /api/v1/runs/{runId}/stream`; final assistant answers are posted back to the same Mattermost channel when AcornOps completes.
- V1 follows one active streamed run per chat thread. A second question in the same thread is rejected while one answer is active.
- `!chat end` works inside a chat thread and closes only that chat. `!chat pause` and `!chat resume` are retired from the main UX. `!sessions`, `!session new`, `!session 1`, `!messages`, and `!ask <question>` remain compatibility commands outside the short help surface.
- The current AcornOps link and resolve contract sends only `{ "externalUserId": "<post author user_id>" }`.
- The user reported the updated live Mattermost `login` and `status` flow works after the user-id-only contract update.
- The bot automatically loads `.env` before reading runtime variables.
- Runtime defaults live in `src/bot/config.js`; change the bot mention name with `MATTERMOST_BOT_USERNAME`.
- Mattermost runtime env vars are `MATTERMOST_URL`, `MATTERMOST_BOT_TOKEN`, and `MATTERMOST_BOT_USERNAME`; the previous prefixed Mattermost names are no longer accepted.
- Docker packaging lives in `Dockerfile`; it installs dependencies inside Docker from `package*.json`, does not copy host `node_modules`, runs as the non-root `node` user, and exposes the optional bot HTTP port.
- `docker-compose.yml` runs the bot image with host-local defaults for Docker Desktop: `MATTERMOST_URL=http://host.docker.internal:8065`, `ACORNOPS_API_BASE_URL=http://host.docker.internal:8081`, and optional HTTP listener settings.
- Mattermost and AcornOps API clients share JSON fetch/error handling through `src/bot/http-client.js`.
- The bot no longer uses `src/bot/auth-store.js`, bot-side login state, transaction polling, plain OIDC link construction, or AcornOps `dev-login` for command login.
- The bot uses `src/bot/commands/context.js` plus `src/bot/state/postgres-store.js` for command memory. Docker Compose now starts a bundled `bot-postgres` service and defaults `BOT_DATABASE_URL` to it. With `BOT_DATABASE_URL`, the bot persists lightweight ids/names for workspaces, targets, clusters, VMs, sessions, chat-thread mappings, active run records, webhook routes, and inbound event ids.
- `!webhook create` creates or shows one user-level delivery URL at `/acornops/webhooks/routes/:routeToken` for the current Mattermost destination. The user pastes that URL into AcornOps console and chooses workspaces/events there. `!webhook connect` claims AcornOps subscription metadata and one-time rotated signing secrets through authenticated AcornOps external-integration APIs. `!webhook status` refreshes live AcornOps subscription state, shows AcornOps `unconfigured`/`configured`/`connected` status, and warns when falling back to cached state. The old global `POST /acornops/webhooks` endpoint and `ACORNOPS_WEBHOOK_SECRET` config are removed.
- `docs/acornops-mattermost-webhook-contract.md` records the AcornOps endpoint contract. It defines the delivery URL, console setup flow, connect/status APIs, TLS requirements, secret handling, exact delivery URL matching, `permissions.manage_webhooks` filtering, status values, and signed delivery headers.
- `B05` authenticated workspace command, `B06` authenticated workspace detail/cluster commands, and `B07` expanded external integration read/assistant commands are implemented with automated tests passing.

## Changes This Session

- Implemented the Mattermost bot UX and alert roadmap: `!` command parsing, threaded multi-chat routing, Postgres-backed command context, inbound HTTP server, Mattermost workspace buttons, and user-level AcornOps webhook routes/alert delivery.
- Fixed the smoke-test follow-ups: workspace button actions now include Mattermost-compatible button type/id payloads and expected action failures return HTTP 200 structured errors; Compose includes a healthy bundled `bot-postgres` database with default bot DB URL; webhook registration now returns signed per-route delivery credentials instead of using the old global signed endpoint.
- Added target selection buttons for `!targets` using the existing `/mattermost/actions` callback path. Workspace and target actions now return quiet HTTP 200 action responses and post one visible success/failure bot message in the main conversation. Live Mattermost logs confirmed local Docker button callbacks require `AllowedUntrustedInternalConnections=host.docker.internal`.
- Shortened context-bearing command replies and `!status`: the repeated Mattermost identity block was replaced by a compact workspace/target header, `!status` now reports only account state plus current workspace/target, and stale bare-command examples were updated to `!` command examples.
- Reworked webhook setup around AcornOps-owned subscription state: added the AcornOps contract doc, proposed connect/status client methods, `!webhook create/connect/status/recreate/disconnect` UX, provider-neutral route state with subscription snapshots, Postgres persistence for connection state, and signature validation against claimed subscription secrets.
- Aligned the webhook route contract with AcornOps' supplied outgoing webhook endpoints and updated Mattermost `!webhook status`/`!webhook connect` output for configured-but-not-claimed subscriptions and one-time secret-claim counts.
- Added `pg` as the Postgres client dependency and ignored host `node_modules/`.
- Added tests for command parsing, thread routing, Mattermost post root/props/attachments, store persistence, HTTP actions, webhook signature/idempotency, and alert posting; `npm test` passed with 104 tests during implementation.
- Renamed runtime Mattermost env vars to `MATTERMOST_URL`, `MATTERMOST_BOT_TOKEN`, and `MATTERMOST_BOT_USERNAME`.
- Renamed active chat timing env vars to `CHAT_RUN_POLL_ATTEMPTS`, `CHAT_RUN_POLL_INTERVAL_MS`, `RUN_STREAM_RECONNECT_ATTEMPTS`, `RUN_STREAM_RECONNECT_DELAY_MS`, `RUN_STREAM_FALLBACK_POLL_INTERVAL_MS`, and `RUN_STREAM_FALLBACK_POLL_MAX_MS`.
- Added Docker image packaging with `Dockerfile`, `.dockerignore`, `docker-compose.yml`, and `scripts/verify-docker.sh`. The verifier builds the Docker `verify` target first so bot lint/build/tests run inside the Node 22 slim image, then builds the final runtime image. Compose provides a local bot-only run path with host-local URL defaults.
- Fixed `test/env.test.js` to use `os.tmpdir()` instead of the macOS-specific `/private/tmp`, which made Docker verification portable.
- Refactored the oversized `src/bot/message.js` command handler into focused modules under domain folders: `src/bot/commands/formatters.js` for response rendering, `src/bot/commands/args.js` for command/filter parsing, `src/bot/commands/errors.js` for AcornOps error copy, `src/bot/commands/context.js` for process-local command memory, `src/bot/chat/runs.js` for chat client-message ids and short run polling, and `src/bot/chat/follower.js` for SSE follow-up delivery.
- Kept `src/bot/message.js` responsible for routing and command side effects while importing the extracted policies.
- Added `R01` to `feature_list.json` as a passing structure-only refactor with verification evidence.
- Reviewed AcornOps public repository READMEs excluding this repository: `acornops-workspace`, `control-plane`, `management-console`, `docs-website`, `acornops-deployment`, `execution-engine`, `llm-gateway`, `k8s-agent`, and `vm-agent`; confirmed `acornops/.github` has no README.
- Replaced the README with an AcornOps-style production service README for the Mattermost bot integration.
- Updated current-state artifacts and startup output to describe the repository as the official AcornOps Mattermost bot integration.
- Updated the account-link and resolve contract to use provider-neutral `externalUserId`.
- Switched runtime setup text to `EXTERNAL_INTEGRATION_SERVICE_TOKEN`.
- Fixed the startup failure caused by the partial identity rename from `mattermostUserId` to `externalUserId`.
- Created branch `feat/add-authenticated-commands`.
- Added `AcornOpsClient.listWorkspaces()` for the provided `GET /api/v1/workspaces` endpoint.
- Added `/workspaces` direct-message command handling, workspace response formatting, empty-state output, next-cursor display, 401 login guidance, and backend-error handling that avoids echoing response bodies.
- Added `AcornOpsClient.getWorkspace()` and `AcornOpsClient.listKubernetesClusters()`.
- Added process-local command context plus `/workspaces 1`, `/workspace`, `/workspace 1`, `/clusters`, and `/clusters 1`.
- Clarified workspace detail behavior: `/workspaces 1` is read-only, `/workspace 1` selects current workspace, and `/workspace` renders current workspace details.
- Updated `feature_list.json`, `PROGRESS.md`, `DECISIONS.md`, and `docs/bot-runtime.md` for workspace detail, current-workspace context, and cluster-listing behavior.
- Implemented the expanded external integration command surface from the updated endpoint contract.
- Changed command parsing to reject slash-prefixed commands.
- Kept only `login` direct-message-only; other authenticated read/read-only assistant commands can run from channel mentions.
- Added client methods and message handlers for cluster detail, resources, findings, investigations, VMs, sessions, messages, and read-only `ask` runs.
- Expanded command context so only one cluster or VM can be selected at a time, and parent selection changes clear dependent session state.
- Merged `feat/add-authenticated-commands` into `main` by fast-forward before starting the June 23 contract work.
- Updated account-link and resolve calls from `/api/v1/auth/chat/integration/*` to `/api/v1/auth/external-integrations/*`.
- Removed the legacy `MATTERMOST_CHAT_SERVICE_TOKEN` env fallback; the bot now requires `EXTERNAL_INTEGRATION_SERVICE_TOKEN`.
- Added optional `externalDisplayName` to link creation from trusted Mattermost sender metadata.
- Updated client, message, runner, config tests, runtime docs, API inventory, decisions, feature evidence, and this handoff for the new contract.
- Removed the old `MATTERMOST_CHAT_SERVICE_TOKEN` runtime behavior from config and client compatibility code; `.env.example` now documents only `EXTERNAL_INTEGRATION_SERVICE_TOKEN`.
- Added the context-plus-chat UX: concise `help`, `help filters`, generic `targets`/`target`, `chat new`, `chat pause`, `chat resume`, `chat end`, active chat-mode free-text question handling, latest-run tracking, and completed-run answer rendering when available.
- Added `docs/wiki-mattermost-bot-commands.md` for advanced filters, aliases, shortcuts, and compatibility commands.
- Fixed chat question idempotency keys to use the Mattermost source post id when available, so retries of the same post are stable but repeated identical questions in separate posts get distinct AcornOps messages/runs.
- Tightened assistant reply rendering to correlate completed runs with the accepted user `message_id` and require exact run-id matches for assistant session-message fallback.
- Simplified identity handling so `src/bot/runner.js` passes the observed Mattermost `post.user_id` only as `userId`; `src/bot/message.js` no longer accepts a separate compatibility identity parameter and derives AcornOps `{ externalUserId }` from `userId`.
- Updated stale bot response copy so workspace, cluster shortcut, VM shortcut, resource, and finding messages reinforce the generic `targets` plus `chat new` user flow.
- After live testing still returned HTTP 400, added structured AcornOps error parsing so chat-message 400 responses show the safe backend `error.code` and `error.message` instead of telling the user to rephrase without evidence.
- Changed active chat questions to poll the read-only run briefly and return the assistant reply directly when available. The fallback now hides session/message/run ids and says AcornOps is still working. Active chat mode is modal: command-looking text such as `status`, `resources`, and `findings` is sent to the assistant until the user sends `chat pause`; chat controls such as `chat pause` and `chat end` remain available.
- Repointed local command-reference links to `docs/wiki-mattermost-bot-commands.md`.
- Added SSE follow-up delivery for long-running chat answers: AcornOpsClient.streamRun(), SSE parser coverage, process-local active run context, src/bot/chat/follower.js with reconnect and polling fallback, runner follow-up effects, one active streamed run per external user, chat pause keeps following, and chat end aborts following.
- Review fix: generic Kubernetes targets selected through `target 1` now create chat sessions through `/api/v1/workspaces/{workspaceId}/targets/{targetId}/sessions` instead of the compatibility Kubernetes cluster session endpoint.
- Removed the historical K3s readiness script from the active harness and updated current docs to keep K3s as learning-stage traceability only.

## Still Broken Or Unverified

- Live smoke for target button clicks still needs to run after rebuilding/restarting the bot. The user confirmed workspace buttons work once Mattermost allows `host.docker.internal` through `AllowedUntrustedInternalConnections`.
- AcornOps-side webhook setup requires coordinated control-plane work to implement or map `docs/acornops-mattermost-webhook-contract.md`; live `!webhook connect` and live status refresh cannot succeed until that contract exists.
- Active SSE network followers are still process-local while running; persisted active-run records do not yet have a restart recovery worker.
- The exact Mattermost post ids and AcornOps response snippets from the passing live account-link smoke are not recorded in this repository.
- Live Mattermost/AcornOps smoke for the June 23 external-integrations endpoint move and the June 26/29/30 context-plus-chat command surface still needs to rerun. For `chat new` followed by a quick question, expect a direct assistant answer when the run completes within the polling window. For a longer run, expect an acknowledgement followed by a later Mattermost post with the final assistant answer.
- `./scripts/verify-mattermost.sh` failed on 2026-06-30 because `localhost:8065` was not listening.
- Postgres-backed command context is implemented, but multi-replica active SSE ownership and restart recovery are still future operational concerns.
- Full image publishing, environment templates, and orchestration manifests are still expected to land in `acornops-deployment`.
- `test/bot-message.test.js` remains large and should be split by command area during a future test-structure refactor.
- The local Mattermost bot token must stay outside committed files.

## Next Best Action

Live-smoke `!login`, `!status`, workspace/target selection, `!resources`, `!findings`, `!workflows`, `!workflow run 1`, workflow SSE output and a same-session thread follow-up, `!chat new`, a threaded question/reply, concurrent chat/workflow threads, thread-local `!chat end`, webhook setup/delivery/deduplication, and bot restart persistence against Compose Postgres.

## Commands

- Startup: `./init.sh`
- Harness verification: `./scripts/verify-harness.sh`
- Mattermost verification: `./scripts/verify-mattermost.sh`
- Bot test: `npm test`
- Bot verification: `npm run verify:bot`
- Docker image verification: `./scripts/verify-docker.sh`
- Bot local run: fill `.env`, then run `npm start`
- AcornOps control-plane health: `curl -fsS http://localhost:8081/health`
