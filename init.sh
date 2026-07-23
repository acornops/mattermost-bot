#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Repository root: ${ROOT_DIR}"
echo "Phase: official AcornOps Mattermost bot integration"
echo

"${ROOT_DIR}/scripts/verify-harness.sh"
"${ROOT_DIR}/scripts/verify-local-stack.sh"
"${ROOT_DIR}/scripts/verify-bot.sh"

cat <<'MSG'

Initialization complete.

Project direction: production Mattermost ChatOps bot for authenticating users to AcornOps through external integrations.
Next action: live-smoke ! commands, buttons (including Run Triage), read-only/read-write threaded chats, workflows, and signed webhook alerts against the local stack.
MSG
