#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

required_files=(
  Taskfile.yml
  env/local/.env.example
  compose/local/compose.yaml
  compose/local/Dockerfile.mattermost
  scripts/local/common.sh
  scripts/local/doctor.sh
  scripts/local/up.sh
  scripts/local/seed.sh
  scripts/local/down.sh
  scripts/local/reset.sh
  scripts/local/ps.sh
  scripts/local/logs.sh
  scripts/local/smoke.sh
  scripts/local/smoke-chat.mjs
  scripts/local/mmctl-json.mjs
)

for file in "${required_files[@]}"; do
  [[ -f "${ROOT_DIR}/${file}" ]] || { echo "ERROR: Missing ${file}." >&2; exit 1; }
done

for script in "${ROOT_DIR}"/scripts/local/*.sh; do
  bash -n "${script}"
done

for script in "${ROOT_DIR}"/scripts/local/*.mjs; do
  node --check "${script}" >/dev/null
done

if command -v shellcheck >/dev/null 2>&1; then
  shellcheck -x -P "${ROOT_DIR}/scripts/local" \
    "${ROOT_DIR}"/scripts/local/*.sh \
    "${ROOT_DIR}/scripts/verify-local-stack.sh"
fi

grep -q 'local-up:' "${ROOT_DIR}/Taskfile.yml"
grep -q 'local-down:' "${ROOT_DIR}/Taskfile.yml"
grep -q 'local-reset:' "${ROOT_DIR}/Taskfile.yml"
grep -q 'SEED_MATTERMOST_DATA' "${ROOT_DIR}/Taskfile.yml"
grep -q 'mattermost-postgres:' "${ROOT_DIR}/compose/local/compose.yaml"
grep -q 'service_completed_successfully' "${ROOT_DIR}/compose/local/compose.yaml"
grep -q 'sha256sum --check' "${ROOT_DIR}/compose/local/Dockerfile.mattermost"
grep -q 'TARGETARCH' "${ROOT_DIR}/compose/local/Dockerfile.mattermost"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose \
    -f "${ROOT_DIR}/docker-compose.yml" \
    -f "${ROOT_DIR}/compose/local/compose.yaml" \
    --env-file "${ROOT_DIR}/env/local/.env.example" \
    config --quiet
fi

echo "Local stack verification passed."
