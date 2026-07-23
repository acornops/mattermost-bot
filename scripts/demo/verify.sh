#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh" "${1:-}"

demo_load_env
demo_validate_env

check_url() {
  local name="$1"
  local url="$2"
  local attempts="${3:-1}"
  local attempt
  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if curl --fail --silent --show-error --max-time 10 "${url}" >/dev/null; then
      demo_ok "${name} responded at ${url}."
      return
    fi
    sleep 5
  done
  demo_fail "${name} did not become ready at ${url}."
}

demo_heading "Verifying the Mattermost demo"
demo_compose ps

backend_ip="$(demo_docker_gateway)"
check_url "Mattermost backend" "http://${backend_ip}:${MATTERMOST_PORT:-8065}/api/v4/system/ping"
check_url "Mattermost bot backend" "http://${backend_ip}:${BOT_HTTP_PORT:-8077}/healthz"
check_url "Public Mattermost" "${MATTERMOST_SITE_URL}/api/v4/system/ping" 60
check_url "Public Mattermost bot" "${BOT_PUBLIC_BASE_URL}/healthz" 60

demo_step "Running a real Mattermost bot command round trip."
demo_compose exec -T mattermost-bot \
  node --input-type=module - \
  "http://mattermost:8065" \
  "${DEMO_MATTERMOST_USER_EMAIL}" \
  "${DEMO_MATTERMOST_USER_PASSWORD}" \
  "${DEMO_MATTERMOST_TEAM}" \
  "${DEMO_MATTERMOST_CHANNEL}" \
  "${MATTERMOST_BOT_USERNAME}" \
  < "${DEMO_ROOT_DIR}/scripts/local/smoke-chat.mjs"

demo_step "Checking AcornOps API reachability from the bot container."
demo_compose exec -T mattermost-bot node -e \
  'fetch(process.env.ACORNOPS_API_BASE_URL+"/api/v1/auth/config").then((response)=>{if(!response.ok){console.error("AcornOps readiness returned HTTP "+response.status);process.exit(1)}}).catch((error)=>{console.error("AcornOps readiness failed: "+error.message);process.exit(1)})'

demo_ok "Mattermost demo verification passed."
