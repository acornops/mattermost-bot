# Decision Log

## 2026-05-25: Start with a harness initializer phase

- Decision: Build repository-local harness infrastructure before product feature work.
- Reason: The workspace is empty, so future agent sessions need explicit startup, state, scope, and verification artifacts before implementation starts.
- Consequence: The first verification target checks harness readiness, not application behavior.

## 2026-05-25: Keep `AGENTS.md` short and routing-oriented

- Decision: `AGENTS.md` acts as the entry map, with details split into topic docs.
- Reason: The harness engineering lectures warn that giant instruction files lose signal and bury important constraints.
- Consequence: New durable rules should usually go into focused docs or executable checks, then be linked from `AGENTS.md`.

## 2026-05-25: Use WIP=1 feature tracking

- Decision: `feature_list.json` allows only one active feature at a time.
- Reason: Agents overreach when multiple features are active, which lowers verified completion rate.
- Consequence: Future sessions should finish or block the active item before selecting another.
