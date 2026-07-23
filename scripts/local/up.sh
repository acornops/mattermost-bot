#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh" "${1:-}"

local_bootstrap_env
requested_seed="${SEED_MATTERMOST_DATA-}"
local_load_env
if [[ -n "${requested_seed}" ]]; then
  SEED_MATTERMOST_DATA="${requested_seed}"
fi

local_heading "Building the local Mattermost runtime"
local_compose build mattermost

local_heading "Starting local Mattermost infrastructure"
local_compose up -d --wait mattermost bot-postgres

if [[ "${SEED_MATTERMOST_DATA:-true}" == "true" ]]; then
  "${SCRIPT_DIR}/seed.sh" "${LOCAL_ENV_FILE}"
else
  local_step "Skipping Mattermost seed because SEED_MATTERMOST_DATA=false."
fi

local_load_env
if [[ -n "${requested_seed}" ]]; then
  SEED_MATTERMOST_DATA="${requested_seed}"
fi
[[ -n "${MATTERMOST_BOT_TOKEN:-}" ]] || local_fail "MATTERMOST_BOT_TOKEN is missing. Enable seeding or provide it in ${LOCAL_ENV_FILE}."

local_heading "Building and starting the Mattermost bot"
local_compose up -d --build --wait --no-deps mattermost-bot

local_ok "Local Mattermost bot stack is ready."
printf 'Mattermost: %s\n' "${MATTERMOST_SITE_URL:-http://localhost:8065}"
printf 'Bot health: %s/healthz\n' "${BOT_HOST_BASE_URL:-http://localhost:${BOT_HTTP_PORT:-8077}}"
printf 'AcornOps console: %s\n' "${ACORNOPS_CONSOLE_BASE_URL:-http://console.acornops.localhost:8088}"
if [[ "${SEED_MATTERMOST_DATA:-true}" == "true" ]]; then
  printf 'Seeded login: %s / %s\n' "${LOCAL_MATTERMOST_USER_EMAIL:-dev@acornops.local}" "${LOCAL_MATTERMOST_USER_PASSWORD:-devpassword}"
  printf 'Seeded channel: %s/%s\n' "${LOCAL_MATTERMOST_TEAM:-csit-lab}" "${LOCAL_MATTERMOST_CHANNEL:-chatops-lab}"
fi
printf '\nNext: task local-smoke\n'
