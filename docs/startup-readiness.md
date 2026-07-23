# Startup Readiness

## Current State

- Repository initialized: yes
- Harness files present: yes
- Product direction selected: yes
- Local learning stack selected: yes
- Application code present: yes
- Application tests present: yes
- Mattermost local setup: task-managed native-architecture stack verified on 2026-07-23 with automatic seed and a live bot command/reply round trip
- AcornOps account-link smoke: `!login` and `!status` worked on 2026-06-10 for the user-id-only contract; the later `externalUserId` rename and `/auth/external-integrations/` endpoint move are covered by automated tests but still need current live smoke
- K3s local readiness: historical learning stage only; the active production bot harness no longer includes a K3s readiness script

## Start Commands

- Standard startup: `./init.sh`
- Harness verification: `./scripts/verify-harness.sh`
- Full local stack: `task local-up`
- Full local smoke: `task local-smoke`

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
- [x] K3s install or access path was verified during the historical learning stage.
- [x] Mattermost local setup path is verified.
- [x] Seeded Mattermost user/team/channel/bot creation is repeatable.
- [x] A live seeded `!help` command receives a bot response.
- [x] Application install command is documented.
- [x] Application test command is documented and verified through `./init.sh`.
- [x] Application lint/static check command is documented and verified through `./init.sh`.
- [x] Application build/start command is documented and verified through `./init.sh`.
- [x] Current AcornOps account-link contract is documented in `docs/acornops-chat-login-contract.md`.
- [ ] Current AcornOps Mattermost `!login` and `!status` flow has live-smoke evidence for the `/auth/external-integrations/` endpoints.

## Fresh Session Test

A fresh session should be able to answer:

1. What is this system?
2. How is it organized?
3. How do I run it?
4. How do I verify it?
5. What is the current progress?

If any answer requires chat history, add or update repo documentation.
