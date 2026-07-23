#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh" "${1:-}"

backend_ip="${2:-$(demo_docker_gateway)}"
[[ "${backend_ip}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] \
  || demo_fail "Invalid Docker bridge backend address: ${backend_ip}"

template="${DEMO_ROOT_DIR}/deploy/demo/kubernetes/ingress.yaml.tpl"
rendered="$(mktemp)"
trap 'rm -f "${rendered}"' EXIT
sed "s/__DEMO_BACKEND_IP__/${backend_ip}/g" "${template}" > "${rendered}"

grep -q '__DEMO_BACKEND_IP__' "${rendered}" \
  && demo_fail "The rendered ingress still contains an unresolved node IP."
demo_kubectl apply -f "${rendered}"
demo_ok "Applied the Mattermost demo ingress adapter for ${backend_ip}."
