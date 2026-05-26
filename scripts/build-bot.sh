#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

while IFS= read -r file; do
  node --check "${file}"
done < <(find "${ROOT_DIR}/src" "${ROOT_DIR}/test" -name '*.js' -type f | sort)

echo "Bot build check passed."
