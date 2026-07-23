#!/usr/bin/env bash

set -euo pipefail

action="${1:-}"
owner_token="${2:-}"
lock_dir="${DEMO_DEPLOY_LOCK_DIR:-/var/lock/acornops-demo-vm-deploy}"
wait_seconds="${DEMO_DEPLOY_LOCK_WAIT_SECONDS:-900}"
stale_seconds="${DEMO_DEPLOY_LOCK_STALE_SECONDS:-7200}"

[[ "${owner_token}" =~ ^[A-Za-z0-9._:/-]+$ ]] || {
  echo "ERROR: A safe deployment-lock owner token is required." >&2
  exit 2
}

acquire() {
  local deadline now created
  deadline=$(( $(date +%s) + wait_seconds ))
  while true; do
    if mkdir "${lock_dir}" 2>/dev/null; then
      umask 077
      printf '%s\n' "${owner_token}" > "${lock_dir}/owner"
      date +%s > "${lock_dir}/created_at"
      echo "Acquired shared demo VM deployment lease."
      return
    fi

    now="$(date +%s)"
    created="$(cat "${lock_dir}/created_at" 2>/dev/null || printf '0')"
    if [[ "${created}" =~ ^[0-9]+$ ]] && (( created > 0 && now - created > stale_seconds )); then
      echo "Removing stale shared demo VM deployment lease." >&2
      rm -f "${lock_dir}/owner" "${lock_dir}/created_at"
      rmdir "${lock_dir}" 2>/dev/null || true
      continue
    fi
    if (( now >= deadline )); then
      echo "ERROR: Timed out waiting for the shared demo VM deployment lease." >&2
      exit 1
    fi
    sleep 5
  done
}

release() {
  local current_owner
  current_owner="$(cat "${lock_dir}/owner" 2>/dev/null || true)"
  if [[ "${current_owner}" != "${owner_token}" ]]; then
    echo "ERROR: Refusing to release a deployment lease owned by another run." >&2
    exit 1
  fi
  rm -f "${lock_dir}/owner" "${lock_dir}/created_at"
  rmdir "${lock_dir}"
  echo "Released shared demo VM deployment lease."
}

case "${action}" in
  acquire) acquire ;;
  release) release ;;
  *)
    echo "Usage: deploy-lock.sh acquire|release <owner-token>" >&2
    exit 2
    ;;
esac
