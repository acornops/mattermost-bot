#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  echo "ERROR: $1" >&2
  echo "FIX: $2" >&2
  exit 1
}

require_file() {
  local path="$1"
  [[ -f "${ROOT_DIR}/${path}" ]] || fail "Missing ${path}." "Create ${path} or restore it from the harness baseline."
}

require_contains() {
  local path="$1"
  local pattern="$2"
  local fix="$3"
  grep -q "${pattern}" "${ROOT_DIR}/${path}" || fail "${path} does not contain required pattern: ${pattern}" "${fix}"
}

require_file "AGENTS.md"
require_file "PROGRESS.md"
require_file "DECISIONS.md"
require_file "feature_list.json"
require_file "docs/startup-readiness.md"
require_file "docs/harness-notes.md"

[[ -x "${ROOT_DIR}/init.sh" ]] || fail "init.sh is not executable." "Run: chmod +x init.sh"
[[ -x "${ROOT_DIR}/scripts/verify-harness.sh" ]] || fail "scripts/verify-harness.sh is not executable." "Run: chmod +x scripts/verify-harness.sh"

require_contains "AGENTS.md" "Startup Routine" "Add a Startup Routine section so new sessions know how to begin."
require_contains "AGENTS.md" "Definition of Done" "Add a Definition of Done section with verification and clean-handoff requirements."
require_contains "PROGRESS.md" "Current Verified State" "Add current repo state, verification path, and next action."
require_contains "DECISIONS.md" "Decision Log" "Keep durable decisions in DECISIONS.md."
require_contains "feature_list.json" "\"features\"" "Add a features array to feature_list.json."
require_contains "feature_list.json" "\"H02\"" "Keep H02 as the next setup feature until the product goal and stack are selected."

echo "Harness verification passed."
