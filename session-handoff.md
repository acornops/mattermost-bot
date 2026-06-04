# Session Handoff

## Currently Verified

- `./init.sh` passes.
- `./scripts/verify-harness.sh` passes.
- `AGENTS.md` includes mechanically checked startup, artifact, definition-of-done, and end-of-session sections.
- Product direction is selected: Mattermost ChatOps bot for authenticating users to AcornOps, a Kubernetes cluster-management backend.
- Initial local learning stack is documented: K3s, kubectl, Helm evaluation, and local Mattermost via Docker.
- Local K3s access is verified through Docker Desktop plus `k3d`.
- `./scripts/verify-k3s.sh` passes when Docker Desktop is running and the `k3d-csit-lab` cluster exists.
- K3s was not reachable during the 2026-05-28 docs audit because the saved `k3d-csit-lab` API port refused connections; restart or recreate the cluster before K3s-dependent work.
- A first nginx workload was deployed, inspected, logged, and cleaned up in K3s.
- Local Mattermost is verified through the official Docker Compose deployment without NGINX at `http://localhost:8065`.
- `./scripts/verify-mattermost.sh` passed on 2026-05-28.
- Mattermost team `csit-lab` and channel `chatops-lab` exist.
- First Mattermost integration style is selected: dedicated bot account, documented in `docs/bot-integrations.md`.
- Bot implementation runtime is selected: Node.js ECMAScript modules with built-in runtime APIs.
- `./scripts/verify-bot.sh` passes and is included in `./init.sh`.
- Local Mattermost bot account evidence currently exists for the older `csit` account; the official bot username is now `acorn-ops-bot` and should be reverified locally.
- Direct-message `login` now calls local AcornOps control-plane `POST /api/v1/auth/dev-login` and stores the returned session cookie in memory by Mattermost user id.

## Changes This Session

- Initial harness baseline exists.
- `AGENTS.md` includes startup workflow, required artifacts, work rules, definition of done, and end-of-session instructions.
- Project direction docs exist in `README.md`, `docs/project-direction.md`, and `docs/local-environment.md`.
- Installed `k3d` 5.8.3 with Homebrew.
- Created local cluster `csit-lab` with one server and one agent.
- Added `scripts/verify-k3s.sh`.
- Recorded L01 and L02 evidence in `PROGRESS.md`, `feature_list.json`, and `docs/local-environment.md`.
- Cloned the official Mattermost Docker deployment to `/private/tmp/mattermost-docker-csit`.
- Configured Mattermost for `http://localhost:8065`.
- Added an Apple Silicon Compose override for the Mattermost app container with `platform: linux/amd64`.
- Added `scripts/verify-mattermost.sh`.
- Created local admin username `csit-admin`, team `csit-lab`, and channel `chatops-lab`.
- Recorded L03 evidence in `PROGRESS.md`, `feature_list.json`, `DECISIONS.md`, and `docs/local-environment.md`.
- Reviewed Mattermost slash commands, webhooks, bot accounts, REST API, plugins, and the deprecated Apps framework for `L04`.
- Added `docs/bot-integrations.md`; later corrected the first integration decision to a dedicated bot account. The official username is now `@acorn-ops-bot`.
- Selected Node.js built-in runtime APIs for `B01`.
- Added `package.json`, `package-lock.json`, `src/bot`, `test`, `scripts/verify-bot.sh`, `scripts/lint-bot.sh`, `scripts/build-bot.sh`, and `docs/bot-runtime.md`.
- Updated `./init.sh` to run bot verification after harness verification.
- Replaced the slash-command HTTP receiver with a Mattermost bot-account process using REST plus WebSocket events.
- Created local bot account `csit` with id `6bcr1d8zxpraxnz77skinxwtoa` and local test user `csit-alice` with id `rcnutpf7fff4mjthsd1gck5p1y`.
- Verified direct-message response in channel `fqxfhfozojystmibobinn8p94w`; user post `dof79es14pyy7fnyifteyieiow` received bot reply `o6tjjqjohpg6ikkbrqtxhmx34c`.
- Updated bot replies to omit `root_id`, so new responses appear as normal main-timeline messages instead of threaded replies. Verified with user post `n6g8tkb9ypdoiewe3yd87mjqae` and bot reply `4pm7b7i43jyxtgj6g19fs15oby`.
- Refreshed repository docs on 2026-05-28 so current state, next action, verification commands, and bot-account architecture match the implemented code.
- Added `B03` as the next not-started feature: define the backend authentication integration boundary without inventing unsupported backend API details.
- Re-scoped and completed `B03` on 2026-06-04 after the AcornOps backend repo was provided. Added `src/bot/acornops-client.js`, `src/bot/auth-store.js`, and wired direct-message `login` to AcornOps `dev-login`.
- Added tests for AcornOps request shape, session-cookie capture, direct-message login behavior, channel login guard, status after login, and runner-level login wiring.
- Deleted the bad `Start OIDC Mattermost login link flow` commit after confirming AcornOps has no `/api/v1/auth/chat/mattermost/*` endpoints. Updated bot defaults, tests, and current docs to use `@acorn-ops-bot`.

## Still Broken Or Unverified

- `login` uses AcornOps non-production `dev-login` as a local-only bridge; production login still needs an OIDC-backed Mattermost identity link.
- The official bot username is `acorn-ops-bot`, but the old live Mattermost evidence used `csit`; reverify against an `acorn-ops-bot` bot account before marking any live username migration passing.
- Cluster listing remains a placeholder until wired to authenticated AcornOps APIs.
- Live AcornOps API smoke passed against `http://localhost:8081` on 2026-06-04 for `/health`, `AcornOpsClient.devLogin()`, and command-level `login` plus `status`.
- The local Mattermost bot token was generated for development and must stay outside committed files.
- The Mattermost checkout and data currently live under `/private/tmp/mattermost-docker-csit`; move them to a durable location if this local server should survive temporary-directory cleanup.

## Next Best Action

Start `B04`: replace the local AcornOps `dev-login` bridge with an OIDC-backed login/link flow that maps AcornOps users to Mattermost user ids, storing pending chat login state on the bot side for now.

## Commands

- Startup: `./init.sh`
- Harness verification: `./scripts/verify-harness.sh`
- K3s verification: `./scripts/verify-k3s.sh`
- Mattermost verification: `./scripts/verify-mattermost.sh`
- K3s cluster list: `k3d cluster list`
- K3s cluster cleanup, if needed: `k3d cluster delete csit-lab`
- Mattermost start: from `/private/tmp/mattermost-docker-csit`, run `docker compose -f docker-compose.yml -f docker-compose.without-nginx.yml -f docker-compose.codex-apple-silicon.yml up -d`
- Mattermost status: from `/private/tmp/mattermost-docker-csit`, run `docker compose -f docker-compose.yml -f docker-compose.without-nginx.yml -f docker-compose.codex-apple-silicon.yml ps`
- Mattermost cleanup: from `/private/tmp/mattermost-docker-csit`, run `docker compose -f docker-compose.yml -f docker-compose.without-nginx.yml -f docker-compose.codex-apple-silicon.yml down`
- Bot install: `npm install`
- Bot test: `npm test`
- Bot lint: `npm run lint`
- Bot build check: `npm run build`
- Bot verification: `npm run verify:bot`
- Bot local run: `CSIT_MATTERMOST_URL=http://localhost:8065 CSIT_MATTERMOST_TOKEN=replace-with-bot-token CSIT_MATTERMOST_BOT_USERNAME=acorn-ops-bot CSIT_ACORNOPS_URL=http://localhost:8081 npm start`
- AcornOps control-plane standalone start: from `/Users/ryangoh/Desktop/Development/acornops/control-plane`, run `docker compose up -d --build`
- AcornOps control-plane health: `curl -fsS http://localhost:8081/health`
