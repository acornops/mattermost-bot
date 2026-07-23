#!/usr/bin/env bash

set -euo pipefail

release_dir="$(cd -P "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
deployment_root="${1:?usage: activate-release.sh DEPLOYMENT_ROOT ENV_FILE RUNTIME_ENV_FILE}"
env_file="${2:?usage: activate-release.sh DEPLOYMENT_ROOT ENV_FILE RUNTIME_ENV_FILE}"
runtime_env_file="${3:?usage: activate-release.sh DEPLOYMENT_ROOT ENV_FILE RUNTIME_ENV_FILE}"
current_link="${deployment_root}/current"
previous_release="$(readlink "${current_link}" 2>/dev/null || true)"

deploy_release() {
  local target="$1"
  local revision
  revision="$(basename "${target}")"
  DEMO_RUNTIME_ENV_FILE="${runtime_env_file}" \
  BOT_IMAGE_TAG="${revision}" \
  BOT_IMAGE_REVISION="${revision}" \
    "${target}/scripts/demo/deploy.sh" "${env_file}"
}

if ! deploy_release "${release_dir}"; then
  if [[ -n "${previous_release}" && -x "${previous_release}/scripts/demo/deploy.sh" ]]; then
    echo "Deployment failed; restoring the previous Mattermost demo release." >&2
    deploy_release "${previous_release}" || {
      echo "ERROR: Automatic rollback also failed." >&2
      exit 1
    }
  fi
  exit 1
fi

ln -sfn "${release_dir}" "${current_link}"
echo "Activated Mattermost demo release $(basename "${release_dir}")."
