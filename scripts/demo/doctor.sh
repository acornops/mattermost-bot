#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh" "${1:-}"

demo_heading "Checking Mattermost demo prerequisites"
demo_require_command docker
demo_require_command curl
demo_require_command sed
demo_require_command tar
docker compose version >/dev/null 2>&1 || demo_fail "Docker Compose v2 is required."

demo_load_env
demo_validate_env
demo_compose config --quiet
demo_ok "Docker Compose configuration is valid."

if command -v k3s >/dev/null 2>&1 || command -v sudo >/dev/null 2>&1; then
  node_ip="$(demo_node_ip)"
  [[ "${node_ip}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] \
    || demo_fail "Could not determine the k3s node InternalIP."
  demo_ok "k3s node is reachable at ${node_ip}."
else
  demo_fail "k3s or sudo is required to manage the demo ingress adapter."
fi

docker_gateway="$(demo_docker_gateway)"
[[ "${docker_gateway}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] \
  || demo_fail "Could not determine Docker's private bridge gateway."
demo_ok "Docker's private bridge gateway is ${docker_gateway}."

available_kib="$(awk '/MemAvailable:/ { print $2 }' /proc/meminfo 2>/dev/null || true)"
if [[ "${available_kib:-0}" -lt 4194304 ]]; then
  demo_fail "At least 4 GiB of available memory is required before starting the demo stack."
fi
demo_ok "Host has at least 4 GiB of available memory."

available_blocks="$(df -Pk "${DEMO_ROOT_DIR}" | awk 'NR == 2 { print $4 }')"
if [[ "${available_blocks:-0}" -lt 10485760 ]]; then
  demo_fail "At least 10 GiB of free disk is required before starting the demo stack."
fi
demo_ok "Host has at least 10 GiB of free disk."

demo_ok "Mattermost demo prerequisites passed."
