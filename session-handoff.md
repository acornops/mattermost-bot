# Session Handoff

## Currently Verified

- `./init.sh` passes.
- `./scripts/verify-harness.sh` passes.
- `AGENTS.md` includes mechanically checked startup, artifact, definition-of-done, and end-of-session sections.
- Product stack has not been selected yet.

## Changes This Session

- Initial harness baseline exists.
- `AGENTS.md` includes startup workflow, required artifacts, work rules, definition of done, and end-of-session instructions.

## Still Broken Or Unverified

- No product source code exists yet.
- No stack-specific install, test, lint, build, start, smoke, or end-to-end command exists yet.

## Next Best Action

Choose the product goal and implementation stack, then update `init.sh`, `docs/startup-readiness.md`, and `feature_list.json` with stack-specific setup and verification.

## Commands

- Startup: `./init.sh`
- Harness verification: `./scripts/verify-harness.sh`
