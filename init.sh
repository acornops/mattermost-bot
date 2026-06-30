#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Repository root: ${ROOT_DIR}"
echo "Phase: official AcornOps Mattermost bot integration"
echo

"${ROOT_DIR}/scripts/verify-harness.sh"
"${ROOT_DIR}/scripts/verify-bot.sh"

cat <<'MSG'

Initialization complete.

Project direction: production Mattermost ChatOps bot for authenticating users to AcornOps through external integrations.
Next action: live-smoke workspace, target, resource, finding, chat-mode, and SSE follow-up flows against the local stack.
MSG
