#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_TAG="${1:-acornops-mattermost-bot:local}"
VERIFY_TAG="${IMAGE_TAG}-verify"

cd "${ROOT_DIR}"

docker build --target verify -t "${VERIFY_TAG}" .
docker build -t "${IMAGE_TAG}" .

echo "Docker image verification passed: ${IMAGE_TAG}"
