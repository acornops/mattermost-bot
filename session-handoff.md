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

## Changes This Session

- Initial harness baseline exists.
- `AGENTS.md` includes startup workflow, required artifacts, work rules, definition of done, and end-of-session instructions.
- Project direction docs exist in `README.md`, `docs/project-direction.md`, and `docs/local-environment.md`.
- Installed `k3d` 5.8.3 with Homebrew.
- Created local cluster `csit-lab` with one server and one agent.
- Added `scripts/verify-k3s.sh`.
- Recorded L01 and L02 evidence in `PROGRESS.md`, `feature_list.json`, and `docs/local-environment.md`.

## Still Broken Or Unverified

- No product source code exists yet.
- Mattermost has not been started or verified from this repo yet.
- No application install, test, lint, build, start, smoke, or end-to-end command exists yet.

## Next Best Action

Start `L03`: set up local Mattermost, record the URL, deployment command, cleanup command, team/channel evidence, then update `PROGRESS.md` and `feature_list.json`.

## Commands

- Startup: `./init.sh`
- Harness verification: `./scripts/verify-harness.sh`
- K3s verification: `./scripts/verify-k3s.sh`
- K3s cluster list: `k3d cluster list`
- K3s cluster cleanup, if needed: `k3d cluster delete csit-lab`
