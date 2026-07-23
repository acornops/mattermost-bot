#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh" "${1:-}"

local_load_env
local_heading "Resetting local Mattermost bot stack"
local_compose down --volumes --remove-orphans
if [[ -f "${LOCAL_RUNTIME_ENV_FILE}" ]]; then
  rm "${LOCAL_RUNTIME_ENV_FILE}"
fi
local_ok "Local Mattermost, bot Postgres, and generated bot-token state were removed."
