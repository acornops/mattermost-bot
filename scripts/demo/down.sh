#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh" "${1:-}"

demo_load_env
demo_compose down
demo_ok "Mattermost demo containers stopped; persistent volumes and ingress were preserved."
