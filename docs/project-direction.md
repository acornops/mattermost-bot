# Project Direction

## Goal

Build a Mattermost ChatOps bot that authenticates Mattermost users to AcornOps and supports governed operations across AcornOps-managed Kubernetes and VM targets.

The backend API is available in `/Users/ryangoh/Desktop/Development/acornops/control-plane`. The repository should keep the Mattermost bot-account prototype restartable while wiring backend-backed commands in small stages.

Historical learning stages already completed:

1. Kubernetes fundamentals with K3s.
2. Local workload deployment and inspection.
3. Local Mattermost setup.
4. Mattermost bot integration options.
5. Bot runtime selection and bot-account conversation scaffolding.
6. Local AcornOps login command.
7. OIDC-backed Mattermost login link.
8. AcornOps-backed external integration account linking with `link` and `resolve`.
9. Expanded AcornOps read and read-only assistant commands through the external integration credential.

## Historical Learning Path

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
- Use AcornOps `POST /api/v1/auth/external-integrations/link` for `!login`.
- Use AcornOps `POST /api/v1/auth/external-integrations/resolve` for `!status`.
- Keep Mattermost identity values sourced from events, not user-supplied chat text.
- Accept `!`-prefixed bot commands rather than slash commands. Keep `!login` direct-message-only; allow authenticated read, workflow, assistant, and user webhook-routing commands from direct messages or channel mentions.
- Persist lightweight command context, thread mappings, webhook routes, and active-run records in Postgres when `BOT_DATABASE_URL` is configured; keep the in-memory store only as a development/test fallback.

## Initial Stack

- K3s for local Kubernetes learning.
- kubectl for cluster interaction.
- Helm as a likely deployment tool to evaluate.
- Mattermost local Docker deployment or preview image for chat-platform learning.
- Dedicated Mattermost bot account as the first Mattermost integration style.
- Node.js ECMAScript modules with built-in runtime APIs for the first bot process.

## Open Decisions

- Whether active-run recovery workers are needed to resume SSE followers after a bot restart.
- What deployment coordination is required for safe multi-replica processing of Mattermost events and run followers.

## Official References

- K3s quick start: https://docs.k3s.io/quick-start
- K3s installation docs: https://docs.k3s.io/installation
- Mattermost Docker install docs: https://docs.mattermost.com/deployment-guide/server/containers/install-docker.html
- Mattermost container deployment docs: https://docs.mattermost.com/deployment-guide/server/deploy-containers.html
