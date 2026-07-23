#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh" "${1:-}"

demo_load_env
demo_validate_env

mmctl_json() {
  demo_compose exec -T mattermost \
    /mattermost/bin/mmctl --local --json --suppress-warnings "$@"
}

mmctl_plain() {
  demo_compose exec -T mattermost \
    /mattermost/bin/mmctl --local --suppress-warnings "$@"
}

json_has() {
  local field="$1"
  local expected="$2"
  grep -Eq "\"${field}\"[[:space:]]*:[[:space:]]*\"${expected}\""
}

demo_heading "Seeding the Mattermost demo"

if ! mmctl_json user search "${DEMO_MATTERMOST_ADMIN_USERNAME}" 2>/dev/null \
  | json_has username "${DEMO_MATTERMOST_ADMIN_USERNAME}"; then
  demo_step "Creating the Mattermost demo administrator."
  mmctl_plain user create \
    --email "${DEMO_MATTERMOST_ADMIN_EMAIL}" \
    --username "${DEMO_MATTERMOST_ADMIN_USERNAME}" \
    --password "${DEMO_MATTERMOST_ADMIN_PASSWORD}" \
    --firstname AcornOps \
    --lastname Administrator \
    --system-admin \
    --email-verified
else
  demo_step "Reconciling the Mattermost demo administrator."
  mmctl_plain user change-password "${DEMO_MATTERMOST_ADMIN_USERNAME}" \
    --password "${DEMO_MATTERMOST_ADMIN_PASSWORD}" >/dev/null
  mmctl_plain roles system_admin "${DEMO_MATTERMOST_ADMIN_USERNAME}" >/dev/null
fi

if ! mmctl_json user search "${DEMO_MATTERMOST_USERNAME}" 2>/dev/null \
  | json_has username "${DEMO_MATTERMOST_USERNAME}"; then
  demo_step "Creating the Mattermost demo user."
  mmctl_plain user create \
    --email "${DEMO_MATTERMOST_USER_EMAIL}" \
    --username "${DEMO_MATTERMOST_USERNAME}" \
    --password "${DEMO_MATTERMOST_USER_PASSWORD}" \
    --firstname AcornOps \
    --lastname Demo \
    --email-verified
else
  demo_step "Reconciling the Mattermost demo user."
  mmctl_plain user change-password "${DEMO_MATTERMOST_USERNAME}" \
    --password "${DEMO_MATTERMOST_USER_PASSWORD}" >/dev/null
fi

if ! mmctl_json team list | json_has name "${DEMO_MATTERMOST_TEAM}"; then
  demo_step "Creating the Mattermost demo team."
  mmctl_plain team create \
    --name "${DEMO_MATTERMOST_TEAM}" \
    --display-name "${DEMO_MATTERMOST_TEAM_DISPLAY_NAME:-AcornOps Demo}" \
    --email "${DEMO_MATTERMOST_ADMIN_EMAIL}"
fi

if ! mmctl_json channel list "${DEMO_MATTERMOST_TEAM}" \
  | json_has name "${DEMO_MATTERMOST_CHANNEL}"; then
  demo_step "Creating the Mattermost demo channel."
  mmctl_plain channel create \
    --team "${DEMO_MATTERMOST_TEAM}" \
    --name "${DEMO_MATTERMOST_CHANNEL}" \
    --display-name "${DEMO_MATTERMOST_CHANNEL_DISPLAY_NAME:-ChatOps}"
fi

if ! mmctl_json user search "${MATTERMOST_BOT_USERNAME}" 2>/dev/null \
  | json_has username "${MATTERMOST_BOT_USERNAME}"; then
  demo_step "Creating the Mattermost bot user."
  mmctl_plain user create \
    --email "${DEMO_MATTERMOST_BOT_EMAIL}" \
    --username "${MATTERMOST_BOT_USERNAME}" \
    --password "${DEMO_MATTERMOST_BOT_INITIAL_PASSWORD}" \
    --firstname AcornOps \
    --lastname Bot \
    --email-verified
fi

if ! mmctl_json bot list 2>/dev/null | json_has username "${MATTERMOST_BOT_USERNAME}"; then
  demo_step "Converting the Mattermost user into a bot account."
  mmctl_plain user convert "${MATTERMOST_BOT_USERNAME}" --bot
fi

mmctl_plain team users add \
  "${DEMO_MATTERMOST_TEAM}" \
  "${DEMO_MATTERMOST_ADMIN_USERNAME}" \
  "${DEMO_MATTERMOST_USERNAME}" \
  "${MATTERMOST_BOT_USERNAME}" >/dev/null
mmctl_plain channel users add \
  "${DEMO_MATTERMOST_TEAM}:${DEMO_MATTERMOST_CHANNEL}" \
  "${DEMO_MATTERMOST_ADMIN_USERNAME}" \
  "${DEMO_MATTERMOST_USERNAME}" \
  "${MATTERMOST_BOT_USERNAME}" >/dev/null

# Calls need separate UDP/TCP exposure and are intentionally out of scope.
mmctl_plain plugin disable com.mattermost.calls >/dev/null 2>&1 || true

if [[ ! -s "${DEMO_RUNTIME_ENV_FILE}" ]] || [[ -z "${MATTERMOST_BOT_TOKEN:-}" ]]; then
  demo_step "Generating and protecting the Mattermost bot token."
  token_json="$(mmctl_json token generate "${MATTERMOST_BOT_USERNAME}" acorn-ops-bot-demo-token)"
  bot_token="$(printf '%s' "${token_json}" \
    | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    | head -1)"
  [[ "${bot_token}" =~ ^[A-Za-z0-9_-]+$ ]] \
    || demo_fail "Mattermost returned an unexpected bot token format."
  install -d -m 0700 "$(dirname "${DEMO_RUNTIME_ENV_FILE}")"
  umask 077
  printf 'MATTERMOST_BOT_TOKEN=%s\n' "${bot_token}" > "${DEMO_RUNTIME_ENV_FILE}"
  chmod 0600 "${DEMO_RUNTIME_ENV_FILE}"
  unset bot_token token_json
else
  demo_step "Reusing the protected Mattermost bot token."
fi

demo_ok "Mattermost demo seed is complete and idempotent."
