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
- First Mattermost integration style is selected: custom slash command, documented in `docs/bot-integrations.md`.
- Bot implementation runtime is selected: Node.js ECMAScript modules with the built-in HTTP server.
- `./scripts/verify-bot.sh` passes and is included in `./init.sh`.
- A local `/csit` slash command receiver exists at `POST /mattermost/slash/csit`.

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
- Added `docs/bot-integrations.md` and recorded the slash-command-first decision.
- Selected Node.js built-in HTTP for `B01`.
- Added `package.json`, `package-lock.json`, `src/bot`, `test`, `scripts/verify-bot.sh`, `scripts/lint-bot.sh`, `scripts/build-bot.sh`, and `docs/bot-runtime.md`.
- Updated `./init.sh` to run bot verification after harness verification.

## Still Broken Or Unverified

- The local `/csit` slash command receiver is not wired into Mattermost yet.
- Backend authentication and cluster listing are placeholders until the backend API exists.
- The Mattermost checkout and data currently live under `/private/tmp/mattermost-docker-csit`; move them to a durable location if this local server should survive temporary-directory cleanup.

## Next Best Action

Start `B02`: wire local Mattermost `/csit` to the bot receiver and record end-to-end response evidence.

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
- Bot local run: `CSIT_MATTERMOST_COMMAND_TOKEN=replace-with-mattermost-token npm start`
