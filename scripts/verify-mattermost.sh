#!/bin/sh
set -eu

echo "Mattermost local readiness check"

if ! curl -fsS http://localhost:8065/api/v4/system/ping >/dev/null; then
  echo "ERROR: Mattermost did not respond at http://localhost:8065/api/v4/system/ping." >&2
  echo "Expected local URL: http://localhost:8065"
  exit 1
fi

echo "Mattermost is responding at http://localhost:8065"
