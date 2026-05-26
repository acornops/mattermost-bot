#!/usr/bin/env bash
set -euo pipefail

CONTEXT="${KUBECTL_CONTEXT:-k3d-csit-lab}"

fail() {
  echo "ERROR: $1" >&2
  echo "FIX: $2" >&2
  exit 1
}

require_command() {
  local name="$1"
  command -v "${name}" >/dev/null 2>&1 || fail "Missing ${name}." "Install ${name} before running K3s verification."
}

require_command kubectl
require_command k3d

kubectl config get-contexts "${CONTEXT}" >/dev/null 2>&1 || fail "Missing kubectl context ${CONTEXT}." "Create the local cluster with: k3d cluster create csit-lab --agents 1"

echo "Kubernetes context: ${CONTEXT}"
kubectl --context "${CONTEXT}" cluster-info
kubectl --context "${CONTEXT}" get nodes -o wide
kubectl --context "${CONTEXT}" get namespaces

echo "K3s verification passed."
