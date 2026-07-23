#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

required_files=(
  compose/demo/compose.yaml
  env/demo/.env.example
  deploy/demo/kubernetes/ingress.yaml.tpl
  scripts/demo/common.sh
  scripts/demo/deploy-lock.sh
  scripts/demo/activate-release.sh
  scripts/demo/doctor.sh
  scripts/demo/seed.sh
  scripts/demo/apply-ingress.sh
  scripts/demo/verify.sh
  scripts/demo/deploy.sh
  scripts/demo/status.sh
  scripts/demo/logs.sh
  scripts/demo/down.sh
  scripts/demo/backup.sh
  scripts/demo/reset.sh
)

for file in "${required_files[@]}"; do
  [[ -f "${ROOT_DIR}/${file}" ]] || { echo "ERROR: Missing ${file}." >&2; exit 1; }
done

for script in "${ROOT_DIR}"/scripts/demo/*.sh "${ROOT_DIR}/scripts/verify-demo-stack.sh"; do
  bash -n "${script}"
done

if command -v shellcheck >/dev/null 2>&1; then
  shellcheck -x -P "${ROOT_DIR}/scripts/demo" \
    "${ROOT_DIR}"/scripts/demo/*.sh \
    "${ROOT_DIR}/scripts/verify-demo-stack.sh"
fi

grep -q 'restart: unless-stopped' "${ROOT_DIR}/compose/demo/compose.yaml"
grep -q 'ENABLESIGNUPWITHEMAIL: "false"' "${ROOT_DIR}/compose/demo/compose.yaml"
grep -q 'mattermost.demo.acornops.dev' "${ROOT_DIR}/deploy/demo/kubernetes/ingress.yaml.tpl"
grep -q 'mattermost-bot.demo.acornops.dev' "${ROOT_DIR}/deploy/demo/kubernetes/ingress.yaml.tpl"
grep -q -- '--volumes' "${ROOT_DIR}/scripts/demo/reset.sh"
grep -q -- '--confirm' "${ROOT_DIR}/scripts/demo/reset.sh"
grep -q 'previous_release' "${ROOT_DIR}/scripts/demo/activate-release.sh"
grep -q 'pg_dump' "${ROOT_DIR}/scripts/demo/backup.sh"
grep -q 'demo_kubectl get nodes --no-headers -o wide' "${ROOT_DIR}/scripts/demo/common.sh"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose \
    --project-name acornops-mattermost-demo \
    -f "${ROOT_DIR}/compose/demo/compose.yaml" \
    --env-file "${ROOT_DIR}/env/demo/.env.example" \
    config --quiet
fi

lock_test_root="$(mktemp -d)"
trap 'rm -rf "${lock_test_root}"' EXIT
DEMO_DEPLOY_LOCK_DIR="${lock_test_root}/lease" \
  "${ROOT_DIR}/scripts/demo/deploy-lock.sh" acquire verify-demo:1 >/dev/null
DEMO_DEPLOY_LOCK_DIR="${lock_test_root}/lease" \
  "${ROOT_DIR}/scripts/demo/deploy-lock.sh" release verify-demo:1 >/dev/null

echo "Demo stack verification passed."
