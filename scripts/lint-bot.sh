#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

while IFS= read -r file; do
  if grep -n '[[:blank:]]$' "${file}"; then
    echo "Trailing whitespace found in ${file}." >&2
    exit 1
  fi
done < <(find "${ROOT_DIR}/src" "${ROOT_DIR}/test" -name '*.js' -type f | sort)

"${ROOT_DIR}/scripts/build-bot.sh"

echo "Bot lint passed."
