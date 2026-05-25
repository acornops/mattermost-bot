#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Repository root: ${ROOT_DIR}"
echo "Phase: harness initializer"
echo

"${ROOT_DIR}/scripts/verify-harness.sh"

cat <<'MSG'

Initialization complete.

No product stack has been selected yet.
Next action: choose the project goal and stack, then update init.sh with real install, verify, and start commands.
MSG
