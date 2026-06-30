# Session Handoff

## Currently Verified

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
- The bot accepts commands without a leading slash only. Slash-prefixed commands return guidance to retry without `/`.
- `login` in direct messages calls AcornOps `POST /api/v1/auth/external-integrations/link` with `{ "externalUserId": "<post author user_id>", "externalDisplayName": "<sender name when available>" }`.
- `status` calls AcornOps `POST /api/v1/auth/external-integrations/resolve` with the same external user id.
- Only `login` is direct-message-only. Authenticated read and read-only assistant commands can run in direct messages or channel mentions.
- `workspaces` calls AcornOps `GET /api/v1/workspaces?limit=50` using `EXTERNAL_INTEGRATION_SERVICE_TOKEN` and `x-acornops-external-user-id` set to the observed Mattermost post author id.
- `workspaces` returns numbered workspace rows and remembers lightweight `{ id, name }` references per external user id.
- `workspaces 1` calls `GET /api/v1/workspaces/{workspaceId}` and shows detail without changing the current workspace.
- `workspace 1` calls `GET /api/v1/workspaces/{workspaceId}`, shows detail, makes that workspace current, and clears current target/session context.
- `workspace` calls `GET /api/v1/workspaces/{workspaceId}` and shows full details for the current workspace.
- `targets` calls `GET /api/v1/workspaces/{workspaceId}/targets?limit=50` for the current workspace; `target 1` selects a generic Kubernetes or VM target.
- `clusters`/`cluster 1` and `vms`/`vm 1` remain compatibility shortcuts for Kubernetes and VM-specific target paths.
- `resources` and `findings` use the currently selected target. `investigations` uses the current workspace.
- `chat new` creates a read-only troubleshooting session for the selected target and enters chat mode. Targets selected through `target 1` use AcornOps generic target session endpoints; compatibility clusters selected through `cluster 1` use Kubernetes cluster session endpoints. While chat mode is active, ordinary messages and command-looking text are sent as read-only AcornOps assistant questions.
- Long-running chat answers are followed over AcornOps SSE through `GET /api/v1/runs/{runId}/stream`; final assistant answers are posted back to the same Mattermost channel when AcornOps completes.
- V1 follows one active streamed run per external user. A second chat question is rejected while one answer is active.
- `chat pause`, `chat resume`, and `chat end` control chat mode. `chat pause` keeps an active run following and still posts the final answer; `chat end` aborts any active run follow and suppresses eventual results. `sessions`, `session new`, `session 1`, `messages`, and `ask <question>` remain compatibility commands outside the short help surface.
- The current AcornOps link and resolve contract sends only `{ "externalUserId": "<post author user_id>" }`.
- The user reported the updated live Mattermost `login` and `status` flow works after the user-id-only contract update.
- The bot automatically loads `.env` before reading runtime variables.
- Runtime defaults live in `src/bot/config.js`; change the bot mention name with `CSIT_MATTERMOST_BOT_USERNAME`.
- Mattermost and AcornOps API clients share JSON fetch/error handling through `src/bot/http-client.js`.
- The bot no longer uses `src/bot/auth-store.js`, bot-side login state, transaction polling, plain OIDC link construction, or AcornOps `dev-login` for command login.
- The bot uses `src/bot/command-context.js` for process-local command memory. It stores only lightweight ids/names for workspaces, targets, clusters, VMs, sessions, active/paused chat state, latest run reference, and one active streamed run pointer; it resets on restart.
- `B05` authenticated workspace command, `B06` authenticated workspace detail/cluster commands, and `B07` expanded external integration read/assistant commands are implemented with automated tests passing.

## Changes This Session

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
- Added SSE follow-up delivery for long-running chat answers: AcornOpsClient.streamRun(), SSE parser coverage, process-local active run context, src/bot/run-follower.js with reconnect and polling fallback, runner follow-up effects, one active streamed run per external user, chat pause keeps following, and chat end aborts following.
- Review fix: generic Kubernetes targets selected through `target 1` now create chat sessions through `/api/v1/workspaces/{workspaceId}/targets/{targetId}/sessions` instead of the compatibility Kubernetes cluster session endpoint.
- Removed the historical K3s readiness script from the active harness and updated current docs to keep K3s as learning-stage traceability only.

## Still Broken Or Unverified

- The exact Mattermost post ids and AcornOps response snippets from the passing live account-link smoke are not recorded in this repository.
- Live Mattermost/AcornOps smoke for the June 23 external-integrations endpoint move and the June 26/29/30 context-plus-chat command surface still needs to rerun. For `chat new` followed by a quick question, expect a direct assistant answer when the run completes within the polling window. For a longer run, expect an acknowledgement followed by a later Mattermost post with the final assistant answer.
- `./scripts/verify-mattermost.sh` failed on 2026-06-30 because `localhost:8065` was not listening.
- The current workspace context and active streamed run following are process-local. Use shared TTL storage later if multi-replica or restart-resilient command context/run following becomes necessary.
- The local Mattermost bot token must stay outside committed files.

## Next Best Action

Live-smoke `login`, `status`, `workspaces`, `workspace 1`, `targets`, `target 1`, `resources`, `findings`, `chat new`, a quick plain chat question, a long-running question that exercises SSE follow-up, a second question while the first is active, `chat pause`, a normal command after pause, `chat resume`, and `chat end` against local Mattermost and AcornOps when the stack is available.

## Commands

- Startup: `./init.sh`
- Harness verification: `./scripts/verify-harness.sh`
- Mattermost verification: `./scripts/verify-mattermost.sh`
- Bot test: `npm test`
- Bot verification: `npm run verify:bot`
- Bot local run: fill `.env`, then run `npm start`
- AcornOps control-plane health: `curl -fsS http://localhost:8081/health`
