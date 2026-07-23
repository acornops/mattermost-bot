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

restart_apps() {
  demo_compose up -d --wait mattermost mattermost-bot >/dev/null
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
