# Local Environment

This project began by learning the local platform before building the ChatOps bot.

`./init.sh` validates configuration but intentionally does not start Docker services. Persistent local services remain explicit through Task commands.

## Current Mattermost Bot Stack

From the repository root:

```sh
task doctor
task local-up
task local-smoke
```

The stack includes Mattermost Team Edition 11.7.0, a dedicated Mattermost Postgres database, the AcornOps bot, and its Postgres state store. `task local-up` seeds a local administrator, `csit-lab` team, `chatops-lab` channel, `acorn-ops-bot` bot account, memberships, and bot access token by default. Every seed operation is safe to repeat.

The default login is `dev@acornops.local` / `devpassword`. Generated secret state lives only in ignored `.local/state/runtime.env` with mode `0600`. To customize the stack, edit ignored `env/local/.env.local` after its first automatic creation. To opt out of seeding, run `task local-up SEED_MATTERMOST_DATA=false` and supply a bot token yourself.

Useful lifecycle commands:

```sh
task local-ps
task local-logs
task local-seed
task local-down
task local-reset
```

`local-down` preserves databases, uploads, configuration, and the generated token. `local-reset` removes the local Compose volumes and generated token so the next `local-up` performs a clean seed.

`task local-smoke` verifies both HTTP health and a real Mattermost channel command/reply round trip. It checks the AcornOps control plane at `http://localhost:8081` by default; use `CHECK_ACORNOPS=false` only for intentionally isolated bot work. If seed automation was disabled, also pass `SEED_MATTERMOST_DATA=false` to skip checks for the standard seeded entities.

Mattermost's official application container is amd64-only for this release. The repo-local development image instead downloads the matching official amd64 or arm64 Team Edition archive, verifies Mattermost's published SHA-256 file, and installs it into a Debian runtime with the same UID and document-conversion utilities. This keeps the local workflow native on Apple Silicon while preserving the separate Mattermost/Postgres topology.

Start the AcornOps platform independently through `acornops-deployment`; this repository does not reset or own its data:

```sh
task --taskfile ../acornops-deployment/Taskfile.yml local-up
```

## Historical K3s First Pass

K3s was part of the early local learning stage. It is no longer part of the active production bot harness, and the repo-local K3s readiness script has been removed. The notes below remain for traceability only.

Use the official K3s docs as the source of truth before installing:

- Quick start: https://docs.k3s.io/quick-start
- Installation: https://docs.k3s.io/installation

This Mac uses Docker Desktop plus `k3d` for local K3s learning. K3s is Linux-native, so `k3d` keeps the cluster inside Docker containers instead of installing a host-level Linux service on macOS.

Verified local setup:

- Host: macOS arm64
- Docker Desktop: available
- k3d: installed with Homebrew as `k3d` 5.8.3
- Cluster: `csit-lab`
- kubectl context: `k3d-csit-lab`
- K3s version observed on nodes: `v1.33.6+k3s1`
- Last successful repo-recorded K3s verification: 2026-05-26
- 2026-05-28 docs audit note: `kubectl --context k3d-csit-lab get nodes -o wide` failed with connection refused on the saved API port, so restart or recreate the k3d cluster before relying on K3s behavior.

Create the local learning cluster:

```sh
brew install k3d
k3d cluster create csit-lab --agents 1
kubectl config current-context
```

Manual verification once K3s is installed:

```sh
sudo k3s kubectl get nodes
sudo k3s kubectl get pods -A
```

If using a copied kubeconfig for regular `kubectl`, verify with:

```sh
kubectl cluster-info
kubectl get nodes
kubectl get namespaces
```

For this repo's `k3d` cluster, use:

```sh
kubectl --context k3d-csit-lab cluster-info
kubectl --context k3d-csit-lab get nodes -o wide
kubectl --context k3d-csit-lab get namespaces
```

First workload exercise:

```sh
kubectl create namespace csit-lab
kubectl create deployment hello-nginx --image=nginx:stable --namespace csit-lab
kubectl expose deployment hello-nginx --port=80 --namespace csit-lab
kubectl get all --namespace csit-lab
kubectl logs --namespace csit-lab deploy/hello-nginx
```

Cleanup:

```sh
kubectl delete namespace csit-lab
```

## Historical Mattermost First Pass

Use the official Mattermost container docs as the source of truth:

- Docker install: https://docs.mattermost.com/deployment-guide/server/containers/install-docker.html
- Container deployment: https://docs.mattermost.com/deployment-guide/server/deploy-containers.html
- Quick start evaluation: https://docs.mattermost.com/deployment-guide/quick-start-evaluation.html

Local evaluation targets:

- Mattermost server starts locally.
- A local team and channel can be created.
- A dedicated `acorn-ops-bot` bot account can be created.
- A test command can be sent through the chosen integration style.

The original `L03` learning path used an external official Mattermost Docker checkout without NGINX. It is retained below for historical evidence; use the task-managed stack above for current development.

This path is still local familiarisation, but it is closer to production than the preview image because it uses the official multi-container deployment with a separate database container and Mattermost application container. The local setup skips NGINX and TLS for now so the server is reachable at `http://localhost:8065`.

Prepare the official Docker deployment checkout outside this repository:

```sh
git clone https://github.com/mattermost/docker
cd docker
cp env.example .env
```

Edit `.env` for local development:

```text
DOMAIN=localhost
MM_SUPPORTSETTINGS_SUPPORTEMAIL=admin@example.com
```

Create the Mattermost data directories:

```sh
mkdir -p ./volumes/app/mattermost/{config,data,logs,plugins,client/plugins,bleve-indexes}
```

For Linux hosts, the official docs set ownership for the Mattermost container user:

```sh
sudo chown -R 2000:2000 ./volumes/app/mattermost
```

On M1/M2/M3 Macs, Mattermost documents that permission issues may be resolved by redoing the directory step and skipping the `chown` command.

Start Mattermost without NGINX:

```sh
docker compose -f docker-compose.yml -f docker-compose.without-nginx.yml up -d
```

Apple Silicon note:

The official Mattermost Enterprise image tag `11.7.0` did not publish a `linux/arm64/v8` image when verified on this machine. Docker Desktop can run the Mattermost application container through AMD64 emulation with a local override file in the official Docker checkout:

```yaml
services:
  mattermost:
    platform: linux/amd64
```

Start with the override:

```sh
docker compose -f docker-compose.yml -f docker-compose.without-nginx.yml -f docker-compose.codex-apple-silicon.yml up -d
```

Local URL:

```text
http://localhost:8065
```

Verify local readiness from this repository:

```sh
./scripts/verify-mattermost.sh
```

Current local readiness:

- Last successful repo-recorded Mattermost verification: 2026-05-28
- Verification evidence: `./scripts/verify-mattermost.sh` reported that Mattermost is responding at `http://localhost:8065`.

Manual setup target after the server is reachable:

1. Open `http://localhost:8065`.
2. Create the first admin account.
3. Create a local team named `csit-lab`.
4. Create a local channel named `chatops-lab`.
5. Create a local bot account named `acorn-ops-bot`.
6. Record the created team, channel, and bot account in `PROGRESS.md`.

Local bot account setup can be done from the Mattermost container:

```sh
docker exec mattermost-docker-csit-mattermost-1 mmctl --local user create \
  --email acorn-ops-bot@example.com \
  --username acorn-ops-bot \
  --password replace-with-local-password \
  --firstname AcornOps \
  --lastname Bot \
  --nickname "AcornOps Bot" \
  --email-verified \
  --disable-welcome-email

docker exec mattermost-docker-csit-mattermost-1 mmctl --local user convert acorn-ops-bot --bot
docker exec mattermost-docker-csit-mattermost-1 mmctl --local token generate acorn-ops-bot acorn-ops-bot-local-token
```

Keep the generated token outside committed files.

Cleanup:

```sh
docker compose -f docker-compose.yml -f docker-compose.without-nginx.yml down
```

Cleanup with the Apple Silicon override:

```sh
docker compose -f docker-compose.yml -f docker-compose.without-nginx.yml -f docker-compose.codex-apple-silicon.yml down
```

Remove all local Mattermost data and settings from the official Docker deployment checkout:

```sh
sudo rm -rf ./volumes
```

## Repo Verification

```sh
./init.sh
./scripts/verify-harness.sh
./scripts/verify-bot.sh
./scripts/verify-local-stack.sh
```

For running local services, use the task smoke test:

```sh
task local-smoke
```

`./init.sh` intentionally does not start Mattermost or Docker containers.
