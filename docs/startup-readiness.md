# Startup Readiness

## Current State

- Repository initialized: yes
- Harness files present: yes
- Product stack selected: no
- Application code present: no
- Application tests present: no

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
- [ ] Product goal is documented.
- [ ] Product stack and versions are documented.
- [ ] Install command is documented and verified.
- [ ] Test command is documented and verified.
- [ ] Lint/static check command is documented and verified.
- [ ] Build/start command is documented and verified.

## Fresh Session Test

A fresh session should be able to answer:

1. What is this system?
2. How is it organized?
3. How do I run it?
4. How do I verify it?
5. What is the current progress?

If any answer requires chat history, add or update repo documentation.
