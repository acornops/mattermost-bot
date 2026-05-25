# CSIT Agent Guide

This repository is designed for long-running coding-agent work. The goal is not to maximize raw code output. The goal is to leave the repo in a state where the next session can continue without guessing.

## Project Status
This repository is in initializer phase. No product stack or business feature has been selected yet.

The current goal is to keep the workspace agent-readable, verifiable, and easy to resume while the project direction is clarified.

## Startup Workflow
Before writing code:

1. Confirm the working directory with `pwd`.
2. Read `PROGRESS.md`.
3. Read `feature_list.json`.
4. Read `DECISIONS.md`.
5. Review recent commits with `git log --oneline -5`.
6. Run `./init.sh`.
7. Run the required smoke or end-to-end verification before starting new work, once a product stack exists.
8. Pick exactly one `not_started` feature from `feature_list.json`, unless the user gives a more specific task.

If baseline verification is already failing, fix that first. Do not stack new feature work on top of a broken starting state.

## Verification Commands
- Harness verification: `./scripts/verify-harness.sh`
- Standard initialization: `./init.sh`

Until a product stack exists, verification means the harness files are present, readable, and internally consistent enough for the next session to resume.

## Required Artifacts
- `feature_list.json`: source of truth for feature and harness work state.
- `PROGRESS.md`: session log and current verified status.
- `DECISIONS.md`: durable project and harness decisions.
- `init.sh`: standard startup and verification path.
- `session-handoff.md`: compact handoff for larger sessions or interrupted work.

## Work Rules
- Work on one feature at a time.
- Do not mark a feature complete just because code was added.
- Do not mark a feature `passing` unless its verification command has been run and evidence is recorded.
- Keep changes within the selected feature scope unless a blocker forces a narrow supporting fix.
- Do not silently change verification rules during implementation.
- Do not rewrite `feature_list.json` to hide unfinished work.
- Prefer adding specific topic docs over expanding this file.
- Prefer durable repo artifacts over chat summaries.

## Definition of Done
A feature is done only when all of the following are true:

- The target behavior is implemented.
- The required verification actually ran.
- Evidence is recorded in `feature_list.json` or `PROGRESS.md`.
- The repository remains restartable from the standard startup path.

## End Of Session
Before ending a session:

1. Update `PROGRESS.md`.
2. Update `feature_list.json`.
3. Record any unresolved risk or blocker.
4. Record any durable decision in `DECISIONS.md`.
5. Run `./init.sh` and any required stack-specific verification.
6. Update `session-handoff.md` for larger sessions or interrupted work.
7. Commit with a descriptive message once the work is in a safe state.
8. Leave the repo clean enough for the next session to run `./init.sh` immediately.

## Topic Docs
- `docs/startup-readiness.md` - initialization acceptance checklist and current startup state.
- `docs/harness-notes.md` - harness design notes and why these files exist.
