# CSIT Agent Guide

## Project Status
This repository is in initializer phase. No product stack or business feature has been selected yet.

The current goal is to keep the workspace agent-readable, verifiable, and easy to resume while the project direction is clarified.

## Startup Routine
At the start of every session:

1. Read this file.
2. Read `PROGRESS.md`.
3. Read `feature_list.json`.
4. Read `DECISIONS.md`.
5. Run `./init.sh`.
6. Pick exactly one `not_started` feature from `feature_list.json`, unless the user gives a more specific task.

## Verification Commands
- Harness verification: `./scripts/verify-harness.sh`
- Standard initialization: `./init.sh`

Until a product stack exists, verification means the harness files are present, readable, and internally consistent enough for the next session to resume.

## Work Rules
- Work on one feature at a time.
- Do not mark a feature `passing` unless its verification command has been run and evidence is recorded.
- Do not rewrite `feature_list.json` to hide unfinished work.
- Prefer adding specific topic docs over expanding this file.
- Keep session state in repo files, not only in chat.

## Definition of Done
A session is complete only when:

- The relevant verification command has passed, or any failure is recorded clearly.
- `PROGRESS.md` reflects the current state.
- `feature_list.json` reflects the selected feature status.
- `DECISIONS.md` records any durable project decision made this session.
- Temporary/debug artifacts are removed or documented.
- The next session can continue using only repository files.

## Topic Docs
- `docs/startup-readiness.md` - initialization acceptance checklist and current startup state.
- `docs/harness-notes.md` - harness design notes and why these files exist.
