# Startup Readiness

## Current State

- Repository initialized: yes
- Harness files present: yes
- Product direction selected: yes
- Local learning stack selected: yes
- Application code present: yes
- Application tests present: yes
- Mattermost local readiness: verified on 2026-05-28 with `./scripts/verify-mattermost.sh`
- AcornOps account-link smoke: user reported `login` and `status` working on 2026-06-10 after the user-id-only contract update; the 2026-06-18 externalUserId contract rename is covered by automated tests and still needs live smoke
- K3s local readiness: previously verified, but not reachable during the 2026-05-28 docs audit because the saved `k3d-csit-lab` API port refused connections

## Start Commands

- Standard startup: `./init.sh`
- Harness verification: `./scripts/verify-harness.sh`

## Initialization Acceptance Checklist

- [x] Repository has an `AGENTS.md` entry file.
- [x] Repository has durable progress state in `PROGRESS.md`.
- [x] Repository has durable decisions in `DECISIONS.md`.
- [x] Repository has machine-readable scope state in `feature_list.json`.
- [x] Repository has a standard initializer command.
- [x] Repository has a harness verification command.
- [x] Product goal is documented.
- [x] Initial local learning stack is documented.
- [x] Bot implementation stack and versions are documented.
- [x] K3s install or access path is verified.
- [x] Mattermost local setup path is verified.
- [x] Application install command is documented.
- [x] Application test command is documented and verified through `./init.sh`.
- [x] Application lint/static check command is documented and verified through `./init.sh`.
- [x] Application build/start command is documented and verified through `./init.sh`.
- [x] Current AcornOps account-link contract is documented in `docs/acornops-chat-login-contract.md`.
- [x] Current AcornOps Mattermost `login` and `status` flow has live-smoke evidence.

## Fresh Session Test

A fresh session should be able to answer:

1. What is this system?
2. How is it organized?
3. How do I run it?
4. How do I verify it?
5. What is the current progress?

If any answer requires chat history, add or update repo documentation.
