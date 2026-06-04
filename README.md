# CSIT

CSIT is a Mattermost ChatOps bot project.

The product direction is to build a bot that helps authenticate Mattermost users to the AcornOps backend system that manages Kubernetes clusters. The current phase is local platform setup plus a verified Mattermost bot-account prototype.

## Current Project Phase

1. Keep the local K3s and Mattermost learning environment restartable.
2. Keep the dedicated Mattermost `@csit` bot account prototype verified.
3. Wire local bot commands to the AcornOps control-plane API in small stages.
4. Replace the local development login bridge with an OIDC-backed login flow.

## Local Learning Stack

- Kubernetes distribution: K3s
- Kubernetes client: kubectl, including the kubectl installed by K3s
- Deployment tooling to evaluate: Helm
- Chat platform: Mattermost local Docker deployment or preview image
- First Mattermost integration style: dedicated Mattermost bot account
- Bot implementation stack: Node.js ECMAScript modules with built-in runtime APIs
- Backend cluster-management API: AcornOps control plane at `/Users/ryangoh/Desktop/Development/acornops/control-plane`

## Primary Docs

- `docs/project-direction.md`: product direction, learning path, and open decisions.
- `docs/local-environment.md`: local K3s and Mattermost setup notes.
- `docs/bot-integrations.md`: Mattermost bot integration options and first prototype decision.
- `docs/bot-runtime.md`: bot runtime decision, bot process shape, and local commands.
- `feature_list.json`: source of truth for current work items.
- `PROGRESS.md`: current verified state and session log.
