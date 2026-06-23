# Project Progress

## Current Verified State

- Repository root directory: `/Users/ryangoh/Desktop/Development/csit`
- Current phase: local learning and platform setup
- Product direction: Mattermost ChatOps bot for authenticating users to AcornOps, a Kubernetes cluster-management backend
- Local learning stack: K3s, kubectl, Helm evaluation, local Mattermost via Docker
- Bot implementation stack: Node.js ECMAScript modules with built-in runtime APIs
- First Mattermost integration style: dedicated bot account
- Standard startup path: `./init.sh`
- Standard verification path: `./scripts/verify-harness.sh`
- K3s readiness verification path: `./scripts/verify-k3s.sh`
- Mattermost readiness verification path: `./scripts/verify-mattermost.sh`
- Bot verification path: `./scripts/verify-bot.sh`
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

## In Progress

- None.

## Known Issues

- `login` direct messages now call AcornOps `POST /api/v1/auth/external-integrations/link` with `externalUserId` set to the Mattermost post author's `user_id` and optional `externalDisplayName` from the Mattermost sender name.
- `status` now calls AcornOps `POST /api/v1/auth/external-integrations/resolve` and reports `linked` or tells unlinked users to run `login`.
- The bot accepts commands without a leading slash only. Slash-prefixed commands return guidance to retry without `/`.
- Only `login` is direct-message-only. Authenticated read and read-only assistant commands can run in direct messages or channel mentions.
- `workspaces` calls AcornOps `GET /api/v1/workspaces?limit=50` with `EXTERNAL_INTEGRATION_SERVICE_TOKEN` and `x-acornops-external-user-id` set to the observed Mattermost post author id.
- `workspaces` returns numbered workspace rows. `workspaces 1` calls `GET /api/v1/workspaces/{workspaceId}` and shows detail without changing the current workspace.
- `workspace 1` calls `GET /api/v1/workspaces/{workspaceId}`, shows detail, and makes that workspace current for the user.
- `workspace` shows full details for the current process-local workspace selection.
- `clusters` calls `GET /api/v1/workspaces/{workspaceId}/kubernetes-clusters?limit=50` for the current workspace. `clusters 1` shows cluster detail without selecting it, and `cluster 1` selects the current cluster.
- `resources` and `findings` use the currently selected cluster or VM. `investigations` uses the current workspace. `vms` lists VMs, `vms 1` shows VM detail, and `vm 1` selects the current VM.
- `sessions`, `session new`, `session 1`, `messages`, and `ask <question>` use read-only assistant-session endpoints for the selected cluster or VM.
- AcornOps moved account-link endpoints on 2026-06-23 to `/auth/external-integrations/`; bot tests now assert the current link and resolve URLs.
- AcornOps updated the account-link contract on 2026-06-18 to require `externalUserId`; the Mattermost adapter supplies the observed post author's Mattermost user id as that external id.
- Bot runtime defaults now live in `src/bot/config.js`; `CSIT_MATTERMOST_BOT_USERNAME` is the runtime source for changing the bot mention name, with `acorn-ops-bot` as the single code fallback.
- The most recent live account-link smoke passed after the earlier user-id-only update; the 2026-06-23 external-integrations endpoint move is covered by automated tests but still needs live smoke.
- The bot remembers only lightweight command context in memory: numbered workspaces, clusters, VMs, sessions, current workspace, one selected target, and current session. It does not store AcornOps browser sessions, cookies, tokens, or link URLs. The context resets when the bot process restarts.
- The K3s verification command did not pass during the 2026-05-28 docs audit because the saved `k3d-csit-lab` API port refused connections.
- Mattermost is running locally through the official Docker Compose deployment without NGINX.
- Mattermost and K3s remain explicit local services; `./init.sh` verifies repo and bot code but does not start Docker Compose or k3d.

## Next Steps

1. Run live Mattermost/AcornOps smoke for `workspaces`, `workspace 1`, `clusters`, `cluster 1`, `resources`, `findings`, `vms`, `vm 1`, `sessions`, `session new`, `messages`, and `ask <question>` when the local stack is available.
2. Add repeatable live-smoke notes for `login`, `status`, workspace, target, and session commands if local service command output becomes available.
3. Decide whether process-local command context is enough or whether shared TTL storage is needed before any multi-replica bot deployment.

## Session Log

Session log entries are historical. Superseded risks and decisions are corrected in later entries and in the Current Verified State above.

### 2026-06-23 - External integration endpoint move adopted

- Goal: Merge the authenticated-command branch into `main`, then update CSIT for the latest AcornOps external integration account-link contracts.
- Completed: Fast-forward merged `feat/add-authenticated-commands` into `main`. Updated the AcornOps client to call `POST /api/v1/auth/external-integrations/link` and `POST /api/v1/auth/external-integrations/resolve`. Kept the existing `EXTERNAL_INTEGRATION_SERVICE_TOKEN` runtime behavior with the legacy `MATTERMOST_CHAT_SERVICE_TOKEN` fallback. Renamed internal config/client paths toward external-integration terminology while keeping compatibility aliases. Added optional `externalDisplayName` from trusted Mattermost sender metadata on link creation. Updated tests and durable docs for the new contract.
- Verification run: Targeted `node --test test/acornops-client.test.js test/bot-message.test.js test/bot-runner.test.js test/config.test.js` passed with 51 tests. Final `./init.sh` passed with harness verification, lint, build, and 64 tests. Local AcornOps health probe failed to connect to `http://localhost:8081/health`; `./scripts/verify-mattermost.sh` failed to connect to `http://localhost:8065/api/v4/system/ping`.
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
- Completed: Installed `k3d` 5.8.3 with Homebrew; created local cluster `csit-lab` with one server and one agent; added `scripts/verify-k3s.sh`; deployed `nginx:stable` as `hello-nginx` in namespace `csit-lab`; exposed it as a ClusterIP service; cleaned up the learning namespace.
- Verification run: `./scripts/verify-k3s.sh` passed against kubectl context `k3d-csit-lab`; workload rollout passed with `deployment "hello-nginx" successfully rolled out`; `kubectl get all --namespace csit-lab -o wide` showed pod `1/1 Running`, service `hello-nginx` on `80/TCP`, deployment `1/1 available`; logs showed nginx `Configuration complete; ready for start up`; `kubectl get namespace csit-lab` returned `NotFound` after cleanup; `./init.sh` passed after artifact updates.
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
- Completed: Added `src/bot/http-client.js` so Mattermost and AcornOps clients share base URL trimming, JSON body serialization, raw-response support, and API error text. Added `src/bot/config.js` so runtime defaults and `CSIT_MATTERMOST_BOT_USERNAME` handling are centralized. Added `src/bot/message-utils.js` for command parsing, mention parsing, regex escaping, and user labels. Kept the current account-link behavior unchanged and kept `B05` not started.
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
- Verification run: Baseline `./init.sh` initially failed with 10 tests because `normalizeMattermostIdentity()` built `externalUserId` but still validated `mattermostUserId`. Targeted verification passed after the fix: `node --test test/acornops-client.test.js test/bot-message.test.js test/bot-runner.test.js test/config.test.js` passed with 33 tests. Final `./init.sh` passed with harness verification, lint, build, and 41 tests.
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
