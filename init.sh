#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Repository root: ${ROOT_DIR}"
echo "Phase: local learning and platform setup"
echo

"${ROOT_DIR}/scripts/verify-harness.sh"
"${ROOT_DIR}/scripts/verify-bot.sh"

cat <<'MSG'

Initialization complete.

Project direction: Mattermost ChatOps bot for authenticating users to AcornOps, a Kubernetes cluster-management backend.
Next action: start B04 by moving login from local dev-login to an OIDC-backed identity link with bot-side pending login storage.
MSG
