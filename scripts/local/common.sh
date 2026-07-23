#!/usr/bin/env bash

set -euo pipefail

LOCAL_ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCAL_ENV_FILE="${1:-${LOCAL_ROOT_DIR}/env/local/.env.local}"
if [[ "${LOCAL_ENV_FILE}" != /* ]]; then
  LOCAL_ENV_FILE="${LOCAL_ROOT_DIR}/${LOCAL_ENV_FILE}"
fi
LOCAL_ENV_EXAMPLE="${LOCAL_ROOT_DIR}/env/local/.env.example"
LOCAL_STATE_DIR="${LOCAL_ROOT_DIR}/.local/state"
LOCAL_RUNTIME_ENV_FILE="${LOCAL_STATE_DIR}/runtime.env"
LOCAL_COMPOSE_FILES=(
  -f "${LOCAL_ROOT_DIR}/docker-compose.yml"
  -f "${LOCAL_ROOT_DIR}/compose/local/compose.yaml"
)

local_heading() {
  printf '\n== %s ==\n' "$1"
}

local_step() {
  printf '%s\n' "-> $1"
}

local_ok() {
  printf '%s\n' "OK: $1"
}

local_fail() {
  printf '%s\n' "ERROR: $1" >&2
  exit 1
}

local_bootstrap_env() {
  if [[ ! -f "${LOCAL_ENV_FILE}" ]]; then
    mkdir -p "$(dirname "${LOCAL_ENV_FILE}")"
    cp "${LOCAL_ENV_EXAMPLE}" "${LOCAL_ENV_FILE}"
    local_ok "Created ${LOCAL_ENV_FILE#"${LOCAL_ROOT_DIR}"/} from the local example."
  fi
}

local_load_env() {
  [[ -f "${LOCAL_ENV_FILE}" ]] || local_fail "Missing ${LOCAL_ENV_FILE}. Run task local-up or copy env/local/.env.example first."
  set -a
  # shellcheck disable=SC1090
  source "${LOCAL_ENV_FILE}"
  if [[ -f "${LOCAL_RUNTIME_ENV_FILE}" ]]; then
    # shellcheck disable=SC1090
    source "${LOCAL_RUNTIME_ENV_FILE}"
  fi
  set +a
}

local_compose() {
  local args=(docker compose "${LOCAL_COMPOSE_FILES[@]}" --env-file "${LOCAL_ENV_FILE}")
  if [[ -f "${LOCAL_RUNTIME_ENV_FILE}" ]]; then
    args+=(--env-file "${LOCAL_RUNTIME_ENV_FILE}")
  fi
  "${args[@]}" "$@"
}

local_require_command() {
  command -v "$1" >/dev/null 2>&1 || local_fail "Required command not found: $1"
}
