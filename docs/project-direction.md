# Project Direction

## Goal

Build a Mattermost ChatOps bot that authenticates Mattermost users to AcornOps, a backend system for managing Kubernetes clusters.

The backend API is available in `/Users/ryangoh/Desktop/Development/acornops/control-plane`. The repository should keep the verified local platform and bot-account prototype restartable while wiring backend-backed commands in small stages:

1. Kubernetes fundamentals with K3s.
2. Local workload deployment and inspection.
3. Local Mattermost setup.
4. Mattermost bot integration options.
5. Bot runtime selection and bot-account conversation scaffolding.
6. Local AcornOps login command.
7. OIDC-backed Mattermost login link.
8. AcornOps-backed Mattermost account linking with `link` and `resolve`.

## Current Learning Path

### Phase 1: K3s And Kubernetes Basics

- Install or access a local K3s cluster.
- Confirm kubeconfig and kubectl access.
- Learn namespaces, deployments, pods, services, config maps, secrets, service accounts, RBAC, and logs.
- Deploy a simple workload and verify it with kubectl.

### Phase 2: Local Mattermost

- Run Mattermost locally for development and evaluation.
- Create a local team, channel, bot account, and test user flow.
- Explore slash commands, incoming webhooks, outgoing webhooks, bot accounts, and plugin/app options.

### Phase 3: ChatOps Prototype

- Use the selected Node.js runtime to run a Mattermost bot account that receives messages and responds.
- The previous local AcornOps `dev-login` bridge was only a development step.
- Use AcornOps `POST /api/v1/auth/chat/integration/link` for `login`.
- Use AcornOps `POST /api/v1/auth/chat/integration/resolve` for `status`.
- Keep Mattermost identity values sourced from events, not user-supplied chat text.
- Wire cluster-listing responses after the authenticated identity model is settled.

## Initial Stack

- K3s for local Kubernetes learning.
- kubectl for cluster interaction.
- Helm as a likely deployment tool to evaluate.
- Mattermost local Docker deployment or preview image for chat-platform learning.
- Dedicated Mattermost bot account as the first Mattermost integration style.
- Node.js ECMAScript modules with built-in runtime APIs for the first bot process.

## Open Decisions

- Local development topology: all Docker Compose, K3s-hosted services, or hybrid.
- How much cluster-management behavior should be mocked before authenticated AcornOps cluster APIs are wired.
- Whether authentication-sensitive actions should be direct-message only, even if general status/help works in channel mentions.

## Official References

- K3s quick start: https://docs.k3s.io/quick-start
- K3s installation docs: https://docs.k3s.io/installation
- Mattermost Docker install docs: https://docs.mattermost.com/deployment-guide/server/containers/install-docker.html
- Mattermost container deployment docs: https://docs.mattermost.com/deployment-guide/server/deploy-containers.html
