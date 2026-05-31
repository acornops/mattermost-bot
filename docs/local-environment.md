# Local Environment

This project starts by learning the local platform before building the ChatOps bot.

Do not make `./init.sh` install K3s or Mattermost automatically yet. K3s changes host-level services, and Mattermost may create persistent Docker volumes. Keep those steps explicit until the team chooses the local topology.

## K3s First Pass

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

Read-only K3s verification:

```sh
./scripts/verify-k3s.sh
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

## Mattermost First Pass

Use the official Mattermost container docs as the source of truth:

- Docker install: https://docs.mattermost.com/deployment-guide/server/containers/install-docker.html
- Container deployment: https://docs.mattermost.com/deployment-guide/server/deploy-containers.html
- Quick start evaluation: https://docs.mattermost.com/deployment-guide/quick-start-evaluation.html

Local evaluation targets:

- Mattermost server starts locally.
- A local team and channel can be created.
- A dedicated `csit` bot account can be created.
- A test command can be sent through the chosen integration style.

Chosen local path for `L03`: official Mattermost Docker Compose deployment without the included NGINX reverse proxy.

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
5. Create a local bot account named `csit`.
6. Record the created team, channel, and bot account in `PROGRESS.md`.

Local bot account setup can be done from the Mattermost container:

```sh
docker exec mattermost-docker-csit-mattermost-1 mmctl --local user create \
  --email csit-bot@example.com \
  --username csit \
  --password replace-with-local-password \
  --firstname CSIT \
  --lastname Bot \
  --nickname CSIT \
  --email-verified \
  --disable-welcome-email

docker exec mattermost-docker-csit-mattermost-1 mmctl --local user convert csit --bot
docker exec mattermost-docker-csit-mattermost-1 mmctl --local token generate csit csit-local-bot-token
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
```

For local services, use the readiness scripts separately:

```sh
./scripts/verify-mattermost.sh
./scripts/verify-k3s.sh
```

`./init.sh` intentionally does not install or start K3s, Mattermost, or Docker containers.
