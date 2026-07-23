#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh" "${1:-}"

demo_load_env
demo_validate_env
"${SCRIPT_DIR}/doctor.sh" "${DEMO_ENV_FILE}"

backend_ip="$(demo_docker_gateway)"
export DEMO_BIND_ADDRESS="${backend_ip}"

demo_heading "Building the Mattermost demo images"
demo_compose build

demo_heading "Starting Mattermost and its databases"
demo_compose up -d --wait mattermost bot-postgres

"${SCRIPT_DIR}/seed.sh" "${DEMO_ENV_FILE}"

demo_heading "Starting the Mattermost bot"
demo_compose up -d --wait --no-deps --force-recreate mattermost-bot

"${SCRIPT_DIR}/apply-ingress.sh" "${DEMO_ENV_FILE}" "${backend_ip}"
"${SCRIPT_DIR}/verify.sh" "${DEMO_ENV_FILE}"

demo_ok "Mattermost demo deployment completed."
