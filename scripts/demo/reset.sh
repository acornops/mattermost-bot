#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh" "${1:-}"

if [[ "${2:-}" != "--confirm" ]]; then
  demo_fail "Reset deletes Mattermost and bot data. Re-run with --confirm."
fi

demo_load_env
demo_compose down --volumes
demo_kubectl delete namespace acornops-mattermost-demo --ignore-not-found
rm -f "${DEMO_RUNTIME_ENV_FILE}"
demo_ok "Mattermost demo containers, volumes, ingress namespace, and generated bot token were deleted."
