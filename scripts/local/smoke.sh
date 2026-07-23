#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh" "${1:-}"

requested_acornops_check="${CHECK_ACORNOPS-}"
requested_seed="${SEED_MATTERMOST_DATA-}"
local_load_env
if [[ -n "${requested_acornops_check}" ]]; then
  CHECK_ACORNOPS="${requested_acornops_check}"
fi
if [[ -n "${requested_seed}" ]]; then
  SEED_MATTERMOST_DATA="${requested_seed}"
fi

check_url() {
  local name="$1"
  local url="$2"
  # The template expression belongs to Node.js, not the shell.
  # shellcheck disable=SC2016
  node -e 'fetch(process.argv[1]).then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); }).catch((error) => { console.error(error.message); process.exit(1); });' "${url}" \
    || local_fail "${name} is not ready at ${url}."
  local_ok "${name} responded at ${url}."
}

local_heading "Checking local Mattermost bot stack"
check_url Mattermost "${MATTERMOST_SITE_URL:-http://localhost:8065}/api/v4/system/ping"
check_url "Mattermost bot" "${BOT_HOST_BASE_URL:-http://localhost:${BOT_HTTP_PORT:-8077}}/healthz"
if [[ "${CHECK_ACORNOPS:-true}" == "true" ]]; then
  check_url AcornOps "${ACORNOPS_HOST_API_BASE_URL:-http://localhost:8081}/health"
else
  local_step "Skipping AcornOps readiness because CHECK_ACORNOPS=false."
fi

if [[ "${SEED_MATTERMOST_DATA:-true}" == "true" ]]; then
  mmctl_json() {
    local_compose exec -T mattermost /mattermost/bin/mmctl --local --json --suppress-warnings "$@"
  }
  json_tool="${SCRIPT_DIR}/mmctl-json.mjs"
  mmctl_json user search "${LOCAL_MATTERMOST_USERNAME:-dev}" \
    | node "${json_tool}" has username "${LOCAL_MATTERMOST_USERNAME:-dev}" \
    || local_fail "Seeded Mattermost developer is missing."
  mmctl_json bot list \
    | node "${json_tool}" has username "${LOCAL_MATTERMOST_BOT_USERNAME:-acorn-ops-bot}" \
    || local_fail "Seeded Mattermost bot is missing."
  mmctl_json team list \
    | node "${json_tool}" has name "${LOCAL_MATTERMOST_TEAM:-csit-lab}" \
    || local_fail "Seeded Mattermost team is missing."
  mmctl_json channel list "${LOCAL_MATTERMOST_TEAM:-csit-lab}" \
    | node "${json_tool}" has name "${LOCAL_MATTERMOST_CHANNEL:-chatops-lab}" \
    || local_fail "Seeded Mattermost channel is missing."
  local_ok "Seeded user, bot, team, and channel are present."

  node "${SCRIPT_DIR}/smoke-chat.mjs" \
    "${MATTERMOST_SITE_URL:-http://localhost:8065}" \
    "${LOCAL_MATTERMOST_USER_EMAIL:-dev@acornops.local}" \
    "${LOCAL_MATTERMOST_USER_PASSWORD:-devpassword}" \
    "${LOCAL_MATTERMOST_TEAM:-csit-lab}" \
    "${LOCAL_MATTERMOST_CHANNEL:-chatops-lab}" \
    "${LOCAL_MATTERMOST_BOT_USERNAME:-acorn-ops-bot}" \
    || local_fail "Seeded Mattermost bot command round trip failed."
  local_ok "Mattermost WebSocket command round trip passed."
  local_ok "Local smoke passed. Open Mattermost and direct-message @${LOCAL_MATTERMOST_BOT_USERNAME:-acorn-ops-bot} with !help."
else
  local_ok "Local service smoke passed without seeded-data checks."
fi
