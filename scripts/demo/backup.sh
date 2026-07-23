#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh" "${1:-}"

demo_load_env
demo_validate_env

backup_root="${DEMO_BACKUP_DIR:-/opt/acornops-mattermost-demo/backups}"
[[ -n "${backup_root}" && "${backup_root}" != "/" ]] \
  || demo_fail "Refusing unsafe demo backup directory: ${backup_root}"
backup_dir="${backup_root}/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 0700 "${backup_dir}"

wait_for_service_healthy() {
  local service="$1"
  local container_id
  local status
  local attempt
  container_id="$(demo_compose ps -q "${service}")"
  [[ -n "${container_id}" ]] || demo_fail "Could not find the ${service} container after backup."
  for ((attempt = 1; attempt <= 60; attempt += 1)); do
    status="$(docker inspect \
      --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
      "${container_id}")"
    [[ "${status}" == "healthy" || "${status}" == "running" ]] && return
    sleep 2
  done
  demo_fail "${service} did not become healthy after backup."
}

restart_apps() {
  # `start` preserves the exact containers, images, environment, and private
  # port bindings. `up` could recreate them from incomplete operator env.
  demo_compose start mattermost mattermost-bot >/dev/null
  wait_for_service_healthy mattermost
  wait_for_service_healthy mattermost-bot
}
trap restart_apps EXIT

demo_heading "Quiescing Mattermost applications for backup"
demo_compose stop mattermost-bot mattermost

demo_step "Dumping Mattermost and bot Postgres databases."
demo_compose exec -T mattermost-postgres \
  pg_dump -U "${MATTERMOST_POSTGRES_USER:-mmuser}" \
  -d "${MATTERMOST_POSTGRES_DB:-mattermost}" -Fc \
  > "${backup_dir}/mattermost-postgres.dump"
demo_compose exec -T bot-postgres \
  pg_dump -U "${BOT_POSTGRES_USER:-acornops_bot}" \
  -d "${BOT_POSTGRES_DB:-acornops_bot}" -Fc \
  > "${backup_dir}/bot-postgres.dump"

demo_step "Archiving Mattermost file and configuration volumes."
for volume in \
  mattermost-config \
  mattermost-data \
  mattermost-plugins \
  mattermost-client-plugins \
  mattermost-bleve-indexes; do
  docker run --rm \
    -v "${DEMO_PROJECT_NAME}_${volume}:/source:ro" \
    -v "${backup_dir}:/backup" \
    alpine:3.22 \
    tar -czf "/backup/${volume}.tar.gz" -C /source .
done

{
  printf 'created_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'project=%s\n' "${DEMO_PROJECT_NAME}"
  printf 'mattermost_version=%s\n' "${MATTERMOST_VERSION:-11.7.0}"
  printf 'bot_image_revision=%s\n' "${BOT_IMAGE_REVISION:-unknown}"
} > "${backup_dir}/manifest.txt"
chmod 0600 "${backup_dir}"/*

demo_ok "Mattermost demo backup created at ${backup_dir}."
