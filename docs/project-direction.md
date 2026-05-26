# Project Direction

## Goal

Build a Mattermost ChatOps bot that authenticates Mattermost users to a backend system for managing Kubernetes clusters.

The backend API contract will be provided later. Until then, the repository should focus on learning and documenting the local platform pieces that the bot will depend on:

1. Kubernetes fundamentals with K3s.
2. Local workload deployment and inspection.
3. Local Mattermost setup.
4. Mattermost bot integration options.
5. Bot runtime selection after the backend API shape is clearer.

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

- Choose a bot implementation runtime.
- Create a minimal local bot that can receive a Mattermost command and respond.
- Add a placeholder authentication flow until the backend API is available.
- Replace the placeholder with the real API integration when provided.

## Initial Stack

- K3s for local Kubernetes learning.
- kubectl for cluster interaction.
- Helm as a likely deployment tool to evaluate.
- Mattermost local Docker deployment or preview image for chat-platform learning.
- Custom slash command as the first Mattermost integration style.

## Open Decisions

- Bot implementation language and framework.
- Backend API authentication protocol.
- Local development topology: all Docker Compose, K3s-hosted services, or hybrid.
- How much cluster-management behavior should be mocked before the real API exists.

## Official References

- K3s quick start: https://docs.k3s.io/quick-start
- K3s installation docs: https://docs.k3s.io/installation
- Mattermost Docker install docs: https://docs.mattermost.com/deployment-guide/server/containers/install-docker.html
- Mattermost container deployment docs: https://docs.mattermost.com/deployment-guide/server/deploy-containers.html
