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

Once the product goal and stack are selected:

1. Add stack-specific setup commands to `init.sh`.
2. Add real test, lint, build, and start commands.
3. Add product features to `feature_list.json`.
4. Add module-level docs near code as the architecture grows.
5. Add end-to-end checks for cross-component behavior.

The current product direction is selected, but application code has not started. The immediate upgrade path is to verify local K3s access, then verify local Mattermost access, then choose and scaffold the bot runtime.
