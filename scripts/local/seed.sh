#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh" "${1:-}"

local_load_env

username="${LOCAL_MATTERMOST_USERNAME:-dev}"
email="${LOCAL_MATTERMOST_USER_EMAIL:-dev@acornops.local}"
password="${LOCAL_MATTERMOST_USER_PASSWORD:-devpass}"
team="${LOCAL_MATTERMOST_TEAM:-csit-lab}"
team_display="${LOCAL_MATTERMOST_TEAM_DISPLAY_NAME:-CSIT Lab}"
channel="${LOCAL_MATTERMOST_CHANNEL:-chatops-lab}"
channel_display="${LOCAL_MATTERMOST_CHANNEL_DISPLAY_NAME:-ChatOps Lab}"
bot_username="${LOCAL_MATTERMOST_BOT_USERNAME:-acorn-ops-bot}"
bot_email="${LOCAL_MATTERMOST_BOT_EMAIL:-acorn-ops-bot@acornops.local}"
bot_password="${LOCAL_MATTERMOST_BOT_INITIAL_PASSWORD:-local-bot-password}"
json_tool="${SCRIPT_DIR}/mmctl-json.mjs"

mmctl_json() {
  local_compose exec -T mattermost /mattermost/bin/mmctl --local --json --suppress-warnings "$@"
}

mmctl_plain() {
  local_compose exec -T mattermost /mattermost/bin/mmctl --local --suppress-warnings "$@"
}

json_has() {
  node "${json_tool}" has "$1" "$2"
}

local_heading "Seeding local Mattermost data"

if ! mmctl_json user search "${username}" 2>/dev/null | json_has username "${username}"; then
  local_step "Creating local developer ${username}."
  mmctl_plain user create \
    --email "${email}" \
    --username "${username}" \
    --password "${password}" \
    --firstname AcornOps \
    --lastname Developer \
    --system-admin \
    --email-verified
else
  local_step "Developer ${username} already exists."
  mmctl_plain user change-password "${username}" --password "${password}" >/dev/null
  mmctl_plain roles system_admin "${username}" >/dev/null
fi

if ! mmctl_json team list | json_has name "${team}"; then
  local_step "Creating team ${team}."
  mmctl_plain team create --name "${team}" --display-name "${team_display}" --email "${email}"
else
  local_step "Team ${team} already exists."
fi

if ! mmctl_json channel list "${team}" | json_has name "${channel}"; then
  local_step "Creating channel ${team}:${channel}."
  mmctl_plain channel create --team "${team}" --name "${channel}" --display-name "${channel_display}"
else
  local_step "Channel ${team}:${channel} already exists."
fi

if ! mmctl_json user search "${bot_username}" 2>/dev/null | json_has username "${bot_username}"; then
  local_step "Creating bot user ${bot_username}."
  mmctl_plain user create \
    --email "${bot_email}" \
    --username "${bot_username}" \
    --password "${bot_password}" \
    --firstname AcornOps \
    --lastname Bot \
    --email-verified
fi

if ! mmctl_json bot list 2>/dev/null | json_has username "${bot_username}"; then
  local_step "Converting ${bot_username} into a bot account."
  mmctl_plain user convert "${bot_username}" --bot
else
  local_step "Bot account ${bot_username} already exists."
fi

mmctl_plain team users add "${team}" "${username}" "${bot_username}" >/dev/null
mmctl_plain channel users add "${team}:${channel}" "${username}" "${bot_username}" >/dev/null

if [[ ! -s "${LOCAL_RUNTIME_ENV_FILE}" ]] || [[ -z "${MATTERMOST_BOT_TOKEN:-}" ]]; then
  local_step "Generating the local bot access token."
  token_json="$(mmctl_json token generate "${bot_username}" acorn-ops-bot-local-token)"
  bot_token="$(printf '%s' "${token_json}" | node "${json_tool}" token)"
  [[ "${bot_token}" =~ ^[A-Za-z0-9_-]+$ ]] || local_fail "Mattermost returned an unexpected bot token format."
  mkdir -p "${LOCAL_STATE_DIR}"
  umask 077
  printf 'MATTERMOST_BOT_TOKEN=%s\n' "${bot_token}" > "${LOCAL_RUNTIME_ENV_FILE}"
  chmod 600 "${LOCAL_RUNTIME_ENV_FILE}"
  unset bot_token token_json
  local_ok "Stored the generated bot token in ignored local state."
else
  local_step "Reusing the generated bot token from ignored local state."
fi

local_ok "Mattermost seed is complete and idempotent."
