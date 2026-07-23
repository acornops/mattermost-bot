#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh" "${1:-}"

local_load_env
local_heading "Stopping local Mattermost bot stack"
local_compose down --remove-orphans
local_ok "Local containers stopped; Mattermost and bot data were preserved."
