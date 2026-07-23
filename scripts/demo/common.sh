#!/usr/bin/env bash

set -euo pipefail

DEMO_ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEMO_ENV_FILE="${1:-${DEMO_ENV_FILE:-${DEMO_ROOT_DIR}/env/demo/.env.demo}}"
if [[ "${DEMO_ENV_FILE}" != /* ]]; then
  DEMO_ENV_FILE="${DEMO_ROOT_DIR}/${DEMO_ENV_FILE}"
fi
DEMO_RUNTIME_ENV_FILE="${DEMO_RUNTIME_ENV_FILE:-${DEMO_ROOT_DIR}/.demo/state/runtime.env}"
DEMO_COMPOSE_FILE="${DEMO_ROOT_DIR}/compose/demo/compose.yaml"
DEMO_PROJECT_NAME="acornops-mattermost-demo"

demo_heading() {
  printf '\n== %s ==\n' "$1"
}

demo_step() {
  printf '%s\n' "-> $1"
}

demo_ok() {
  printf '%s\n' "OK: $1"
}

demo_fail() {
  printf '%s\n' "ERROR: $1" >&2
  exit 1
}

demo_require_command() {
  command -v "$1" >/dev/null 2>&1 || demo_fail "Required command not found: $1"
}

demo_load_env() {
  [[ -f "${DEMO_ENV_FILE}" ]] || demo_fail "Missing demo environment file: ${DEMO_ENV_FILE}"
  set -a
  # The deployment environment is operator-controlled and mode 0600 on the VM.
  # shellcheck disable=SC1090
  source "${DEMO_ENV_FILE}"
  if [[ -f "${DEMO_RUNTIME_ENV_FILE}" ]]; then
    # shellcheck disable=SC1090
    source "${DEMO_RUNTIME_ENV_FILE}"
  fi
  set +a
}

demo_require_env() {
  local name="$1"
  [[ -n "${!name:-}" ]] || demo_fail "Required environment value is missing: ${name}"
}

demo_validate_env() {
  local required=(
    MATTERMOST_POSTGRES_PASSWORD
    BOT_POSTGRES_PASSWORD
    DEMO_MATTERMOST_ADMIN_USERNAME
    DEMO_MATTERMOST_ADMIN_EMAIL
    DEMO_MATTERMOST_ADMIN_PASSWORD
    DEMO_MATTERMOST_USERNAME
    DEMO_MATTERMOST_USER_EMAIL
    DEMO_MATTERMOST_USER_PASSWORD
    DEMO_MATTERMOST_TEAM
    DEMO_MATTERMOST_CHANNEL
    MATTERMOST_BOT_USERNAME
    DEMO_MATTERMOST_BOT_EMAIL
    DEMO_MATTERMOST_BOT_INITIAL_PASSWORD
    EXTERNAL_INTEGRATION_SERVICE_TOKEN
    MATTERMOST_ACTION_SECRET
  )
  local name
  for name in "${required[@]}"; do
    demo_require_env "${name}"
  done

  for name in MATTERMOST_POSTGRES_PASSWORD BOT_POSTGRES_PASSWORD; do
    [[ "${!name}" =~ ^[A-Za-z0-9._~-]+$ ]] \
      || demo_fail "${name} must be URL-safe because it is embedded in a Postgres connection URL."
  done

  for name in \
    DEMO_MATTERMOST_ADMIN_USERNAME \
    DEMO_MATTERMOST_USERNAME \
    DEMO_MATTERMOST_TEAM \
    DEMO_MATTERMOST_CHANNEL \
    MATTERMOST_BOT_USERNAME; do
    [[ "${!name}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] \
      || demo_fail "${name} must be a lowercase Mattermost-safe slug."
  done

  [[ "${MATTERMOST_SITE_URL:-}" == https://* ]] \
    || demo_fail "MATTERMOST_SITE_URL must use HTTPS."
  [[ "${BOT_PUBLIC_BASE_URL:-}" == https://* ]] \
    || demo_fail "BOT_PUBLIC_BASE_URL must use HTTPS."
  [[ "${ACORNOPS_API_BASE_URL:-}" == https://* ]] \
    || demo_fail "ACORNOPS_API_BASE_URL must use HTTPS."
}

demo_compose() {
  local args=(
    docker compose
    --project-name "${DEMO_PROJECT_NAME}"
    -f "${DEMO_COMPOSE_FILE}"
    --env-file "${DEMO_ENV_FILE}"
  )
  if [[ -f "${DEMO_RUNTIME_ENV_FILE}" ]]; then
    args+=(--env-file "${DEMO_RUNTIME_ENV_FILE}")
  fi
  "${args[@]}" "$@"
}

demo_kubectl() {
  if [[ "$(id -u)" -eq 0 ]]; then
    k3s kubectl "$@"
  else
    sudo k3s kubectl "$@"
  fi
}

demo_node_ip() {
  demo_kubectl get nodes \
    -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}'
}

demo_docker_gateway() {
  docker network inspect bridge --format '{{(index .IPAM.Config 0).Gateway}}'
}
