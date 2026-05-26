# CSIT

CSIT is a Mattermost ChatOps bot project.

The product direction is to build a bot that helps authenticate Mattermost users to a backend system that manages Kubernetes clusters. The backend API will be provided later, so the current phase is environment learning and local platform setup.

## Current Project Phase

1. Learn Kubernetes locally with K3s.
2. Deploy and inspect simple workloads on K3s.
3. Set up Mattermost locally for bot and ChatOps exploration.
4. Prototype the first Mattermost integration as a dedicated bot account.
5. Decide the bot implementation runtime once the backend API shape is known.

## Local Learning Stack

- Kubernetes distribution: K3s
- Kubernetes client: kubectl, including the kubectl installed by K3s
- Deployment tooling to evaluate: Helm
- Chat platform: Mattermost local Docker deployment or preview image
- First Mattermost integration style: dedicated Mattermost bot account
- Bot implementation stack: Node.js ECMAScript modules with built-in runtime APIs
- Backend cluster-management API: pending external contract

## Primary Docs

- `docs/project-direction.md`: product direction, learning path, and open decisions.
- `docs/local-environment.md`: local K3s and Mattermost setup notes.
- `docs/bot-integrations.md`: Mattermost bot integration options and first prototype decision.
- `docs/bot-runtime.md`: bot runtime decision, command receiver shape, and local commands.
- `feature_list.json`: source of truth for current work items.
- `PROGRESS.md`: current verified state and session log.
