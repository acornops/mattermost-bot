#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Repository root: ${ROOT_DIR}"
echo "Phase: local learning and platform setup"
echo

"${ROOT_DIR}/scripts/verify-harness.sh"

cat <<'MSG'

Initialization complete.

Project direction: Mattermost ChatOps bot for authenticating users to a Kubernetes cluster-management backend.
Next action: set up local Mattermost, then record the URL, deployment command, cleanup command, and team/channel evidence.
MSG
