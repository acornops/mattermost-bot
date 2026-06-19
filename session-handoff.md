# Session Handoff

## Currently Verified

- Final `./init.sh` passed after the June 19 workspace-detail behavior clarification with harness verification, lint, build, and 53 tests.
- Final `./init.sh` passed after the June 19 workspace-context and cluster-command work with harness verification, lint, build, and 52 tests.
- Final `./init.sh` passed after the June 18 external integration contract update with harness verification, lint, build, and 41 tests.
- Baseline `./init.sh` passed before the June 19 workspace-context and cluster-command work with harness verification, lint, build, and 41 tests.
- Targeted workspace-context and cluster-command tests passed after implementation: `node --test test/acornops-client.test.js` with 6 tests, `node --test test/command-context.test.js` with 3 tests, `node --test test/bot-message.test.js` with 24 tests, and `node --test test/bot-runner.test.js` with 8 tests.
- Baseline `./init.sh` passed before the June 18 workspace-command work with harness verification, lint, build, and 31 tests.
- Targeted workspace-command tests passed after implementation: `node --test test/acornops-client.test.js` with 4 tests, `node --test test/bot-message.test.js` with 19 tests, and `node --test test/bot-runner.test.js` with 7 tests.
- `./scripts/verify-harness.sh` passes.
- Product direction is selected: Mattermost ChatOps bot for authenticating users to AcornOps, a Kubernetes cluster-management backend.
- Local Mattermost is documented through the official Docker Compose deployment without NGINX at `http://localhost:8065`.
- First Mattermost integration style is selected: dedicated bot account `@acorn-ops-bot`.
- Bot implementation runtime is Node.js ECMAScript modules with built-in runtime APIs.
- The bot responds to Mattermost direct messages and channel mentions through REST plus WebSocket events.
- `login` and `/login` in direct messages call AcornOps `POST /api/v1/auth/chat/integration/link` with `{ "externalUserId": "<post author user_id>" }`.
- `status` and `/status` call AcornOps `POST /api/v1/auth/chat/integration/resolve` with the same external user id.
- `workspaces` and `/workspaces` in direct messages call AcornOps `GET /api/v1/workspaces?limit=50` using `EXTERNAL_INTEGRATION_SERVICE_TOKEN` and `x-acornops-external-user-id` set to the observed Mattermost post author id.
- `/workspaces` returns numbered workspace rows and remembers lightweight `{ id, name }` references per external user id.
- `/workspaces 1` calls `GET /api/v1/workspaces/{workspaceId}` and shows detail without changing the current workspace.
- `/workspace 1` calls `GET /api/v1/workspaces/{workspaceId}`, shows detail, and makes that workspace current.
- `/workspace` calls `GET /api/v1/workspaces/{workspaceId}` and shows full details for the current workspace.
- `/clusters` calls `GET /api/v1/workspaces/{workspaceId}/kubernetes-clusters?limit=50` for the current workspace; `/clusters 1` uses a remembered workspace number and makes it current.
- The current AcornOps link and resolve contract sends only `{ "externalUserId": "<post author user_id>" }`.
- The user reported the updated live Mattermost `login` and `status` flow works after the user-id-only contract update.
- The bot automatically loads `.env` before reading runtime variables.
- Runtime defaults live in `src/bot/config.js`; change the bot mention name with `CSIT_MATTERMOST_BOT_USERNAME`.
- Mattermost and AcornOps API clients share JSON fetch/error handling through `src/bot/http-client.js`.
- The bot no longer uses `src/bot/auth-store.js`, bot-side login state, transaction polling, plain OIDC link construction, or AcornOps `dev-login` for command login.
- The bot uses `src/bot/command-context.js` for process-local workspace list/current workspace memory. It stores only workspace ids and names and resets on restart.
- `B05` authenticated workspace command and `B06` authenticated workspace detail/cluster commands are implemented with targeted tests passing.

## Changes This Session

- Updated the account-link and resolve contract to use provider-neutral `externalUserId`.
- Switched runtime setup text to `EXTERNAL_INTEGRATION_SERVICE_TOKEN`, with `MATTERMOST_CHAT_SERVICE_TOKEN` retained as a backward-compatible env fallback.
- Fixed the startup failure caused by the partial identity rename from `mattermostUserId` to `externalUserId`.
- Created branch `feat/add-authenticated-commands`.
- Added `AcornOpsClient.listWorkspaces()` for the provided `GET /api/v1/workspaces` endpoint.
- Added `/workspaces` direct-message command handling, workspace response formatting, empty-state output, next-cursor display, 401 login guidance, and backend-error handling that avoids echoing response bodies.
- Added `AcornOpsClient.getWorkspace()` and `AcornOpsClient.listKubernetesClusters()`.
- Added process-local command context plus `/workspaces 1`, `/workspace`, `/workspace 1`, `/clusters`, and `/clusters 1`.
- Clarified workspace detail behavior: `/workspaces 1` is read-only, `/workspace 1` selects current workspace, and `/workspace` renders current workspace details.
- Updated `feature_list.json`, `PROGRESS.md`, `DECISIONS.md`, and `docs/bot-runtime.md` for workspace detail, current-workspace context, and cluster-listing behavior.

## Still Broken Or Unverified

- The exact Mattermost post ids and AcornOps response snippets from the passing live account-link smoke are not recorded in this repository.
- Live Mattermost/AcornOps smoke for workspace detail and cluster commands did not run because Mattermost was not listening on `localhost:8065` and AcornOps was not listening on `localhost:8081`.
- The current workspace context is process-local. Use shared TTL storage later if multi-replica or restart-resilient command context becomes necessary.
- The local Mattermost bot token must stay outside committed files.

## Next Best Action

Live-smoke `/workspaces`, `/workspaces 1`, `/workspace 1`, `/workspace`, and `/clusters` against local Mattermost and AcornOps when the stack is available.

## Commands

- Startup: `./init.sh`
- Harness verification: `./scripts/verify-harness.sh`
- Mattermost verification: `./scripts/verify-mattermost.sh`
- Bot test: `npm test`
- Bot verification: `npm run verify:bot`
- Bot local run: fill `.env`, then run `npm start`
- AcornOps control-plane health: `curl -fsS http://localhost:8081/health`
