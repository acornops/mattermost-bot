# Harness Notes

## Purpose

This repository starts with a harness-first baseline. The harness exists to make future agent work reliable by externalizing instructions, state, scope, verification, and handoff requirements.

## Current Harness Shape

- `AGENTS.md`: short entry map and operating rules.
- `PROGRESS.md`: durable current state and session log.
- `DECISIONS.md`: durable design and harness decisions.
- `feature_list.json`: machine-readable source of truth for work scope.
- `init.sh`: standard startup path.
- `scripts/verify-harness.sh`: current verification command.
- `docs/startup-readiness.md`: initialization acceptance state.

## Design Principles

- Keep entry instructions short.
- Store durable knowledge in repository files.
- Use WIP=1 until there is a strong reason not to.
- Treat verification evidence as the gate for completion.
- Turn repeated review feedback into docs or executable checks.
- End every session with a clean handoff.

## Upgrade Path

The product goal, local learning stack, and first bot runtime are now selected. Continue upgrading the harness by:

1. Keeping `./init.sh` focused on non-mutating repo and bot verification.
2. Keeping host-level services such as k3d and Mattermost explicit until the local topology is settled.
3. Adding product features to `feature_list.json` before implementation begins.
4. Adding module-level docs near code as the architecture grows.
5. Adding repeatable end-to-end checks for cross-component behavior when they can run without leaking local secrets.

The immediate next product path is to finish the AcornOps chat-login completion API boundary so the bot can resolve a completed browser OIDC login back to the Mattermost user.
