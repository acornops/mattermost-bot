# Local Environment

This project starts by learning the local platform before building the ChatOps bot.

Do not make `./init.sh` install K3s or Mattermost automatically yet. K3s changes host-level services, and Mattermost may create persistent Docker volumes. Keep those steps explicit until the team chooses the local topology.

## K3s First Pass

Use the official K3s docs as the source of truth before installing:

- Quick start: https://docs.k3s.io/quick-start
- Installation: https://docs.k3s.io/installation

Expected verification once K3s is installed:

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

Local evaluation targets:

- Mattermost server starts locally.
- A local team and channel can be created.
- A bot account or integration can be created.
- A test message can be sent through the chosen integration style.

## Repo Verification During Learning Phase

Until application code exists:

```sh
./init.sh
./scripts/verify-harness.sh
```

After K3s or Mattermost setup begins, add a script that verifies only local readiness and does not mutate host services.
