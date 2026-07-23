#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh" "${1:-}"

local_heading "Checking local Mattermost bot prerequisites"
local_require_command docker
local_require_command node
local_require_command task

docker compose version >/dev/null
docker info >/dev/null
node --version
docker compose version
task --version

if [[ -f "${LOCAL_ENV_FILE}" ]]; then
  local_ok "Local environment exists at ${LOCAL_ENV_FILE#"${LOCAL_ROOT_DIR}"/}."
else
  local_step "Local environment will be created from env/local/.env.example by task local-up."
fi

local_ok "Doctor passed. task local-up is ready to run."
