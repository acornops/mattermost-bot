# Session Handoff

## Currently Verified

- `./init.sh` passes.
- `./scripts/verify-harness.sh` passes.
- `AGENTS.md` includes mechanically checked startup, artifact, definition-of-done, and end-of-session sections.
- Product direction is selected: Mattermost ChatOps bot for authenticating users to a Kubernetes cluster-management backend.
- Initial local learning stack is documented: K3s, kubectl, Helm evaluation, and local Mattermost via Docker.
- Local K3s access is verified through Docker Desktop plus `k3d`.
- `./scripts/verify-k3s.sh` passes when Docker Desktop is running and the `k3d-csit-lab` cluster exists.
- A first nginx workload was deployed, inspected, logged, and cleaned up in K3s.
- Local Mattermost is verified through the official Docker Compose deployment without NGINX at `http://localhost:8065`.
- `./scripts/verify-mattermost.sh` passes when run with host-local access.
- Mattermost team `csit-lab` and channel `chatops-lab` exist.
- First Mattermost integration style is selected: dedicated bot account, documented in `docs/bot-integrations.md`.
- Bot implementation runtime is selected: Node.js ECMAScript modules with built-in runtime APIs.
- `./scripts/verify-bot.sh` passes and is included in `./init.sh`.
- Local Mattermost bot account `csit` exists and can respond to direct messages.

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
- Added `docs/bot-integrations.md`; later corrected the first integration decision to a dedicated `@csit` bot account.
- Selected Node.js built-in runtime APIs for `B01`.
- Added `package.json`, `package-lock.json`, `src/bot`, `test`, `scripts/verify-bot.sh`, `scripts/lint-bot.sh`, `scripts/build-bot.sh`, and `docs/bot-runtime.md`.
- Updated `./init.sh` to run bot verification after harness verification.
- Replaced the slash-command HTTP receiver with a Mattermost bot-account process using REST plus WebSocket events.
- Created local bot account `csit` with id `6bcr1d8zxpraxnz77skinxwtoa` and local test user `csit-alice` with id `rcnutpf7fff4mjthsd1gck5p1y`.
- Verified direct-message response in channel `fqxfhfozojystmibobinn8p94w`; user post `dof79es14pyy7fnyifteyieiow` received bot reply `o6tjjqjohpg6ikkbrqtxhmx34c`.

## Still Broken Or Unverified

- Backend authentication and cluster listing are placeholders until the backend API exists.
- The local Mattermost bot token was generated for development and must stay outside committed files.
- The Mattermost checkout and data currently live under `/private/tmp/mattermost-docker-csit`; move them to a durable location if this local server should survive temporary-directory cleanup.

## Next Best Action

Design the backend authentication handoff once the backend API contract is available, including how direct-message prompts and channel mentions should differ for sensitive actions.

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
- Bot local run: `CSIT_MATTERMOST_URL=http://localhost:8065 CSIT_MATTERMOST_TOKEN=replace-with-bot-token CSIT_MATTERMOST_BOT_USERNAME=csit npm start`
