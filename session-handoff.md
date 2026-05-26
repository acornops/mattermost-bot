# Session Handoff

## Currently Verified

- `./init.sh` passes.
- `./scripts/verify-harness.sh` passes.
- `AGENTS.md` includes mechanically checked startup, artifact, definition-of-done, and end-of-session sections.
- Product direction is selected: Mattermost ChatOps bot for authenticating users to a Kubernetes cluster-management backend.
- Initial local learning stack is documented: K3s, kubectl, Helm evaluation, and local Mattermost via Docker.

## Changes This Session

- Initial harness baseline exists.
- `AGENTS.md` includes startup workflow, required artifacts, work rules, definition of done, and end-of-session instructions.
- Project direction docs exist in `README.md`, `docs/project-direction.md`, and `docs/local-environment.md`.

## Still Broken Or Unverified

- No product source code exists yet.
- K3s has not been installed or verified from this repo yet.
- Mattermost has not been started or verified from this repo yet.
- No application install, test, lint, build, start, smoke, or end-to-end command exists yet.

## Next Best Action

Start `L01`: verify local K3s access, record the commands and evidence, then update `PROGRESS.md` and `feature_list.json`.

## Commands

- Startup: `./init.sh`
- Harness verification: `./scripts/verify-harness.sh`
