# Bot Auth Sessions

## Decision

Use in-memory auth storage only for local development and tests. For a scalable bot deployment, store pending login state and completed Mattermost-to-AcornOps identity links in shared backend storage.

Preferred production split:

- Redis or another TTL-native store for short-lived pending OIDC login state.
- Postgres or another durable database for long-lived Mattermost identity links and audit-relevant metadata.
- Do not store raw AcornOps browser session cookies in Mattermost chat history or unencrypted bot-local state.

## Why Not Process Memory

Process memory is acceptable for the current local prototype because there is one bot process and no restart durability expectation. It is not scalable because:

- multiple bot replicas would have different pending-login maps;
- a restart would erase pending login state;
- future proactive follow-up or approval flows need stable user identity across processes;
- support/debugging needs auditable state transitions.

## Current CSIT Implementation

`src/bot/auth-store.js` exposes a small store interface:

- `createPendingLogin(...)`
- `getPendingLogin(mattermostUserId)`
- `clearPendingLogin(mattermostUserId)`
- `completePendingLogin(mattermostUserId, session)`
- `setSession(mattermostUserId, session)`
- `getSession(mattermostUserId)`

The shipped implementation is `createMemoryAuthStore()`. Command handling depends on the interface, not on `Map` directly, so a later Redis/Postgres implementation can replace it without rewriting Mattermost command parsing.

## Current OIDC Flow Without Backend Chat API

1. A user sends `login` in a direct message to `@acorn-ops-bot`.
2. The bot creates bot-side pending login state for the Mattermost `user_id`.
3. The bot sends a browser link to AcornOps `GET /api/v1/auth/oidc/login`.
4. AcornOps completes OIDC in the browser, creates its own cookie-backed user session, and redirects to `CSIT_ACORNOPS_LOGIN_RETURN_TO` or `/api/v1/me`.
5. The bot leaves the chat login state pending because AcornOps does not yet expose a chat-completion signal.

This keeps passwords out of Mattermost and removes the old `dev-login` bridge from the command path, while avoiding a fake success state.

## Backend Chat Login Flow

When `CSIT_ACORNOPS_CHAT_SERVICE_TOKEN` is configured, the bot uses a backend-owned chat-login transaction instead of a plain OIDC link:

1. The bot calls `POST /api/v1/auth/chat/mattermost/login` with the Mattermost user id/name and a return target.
2. AcornOps creates a short-lived transaction and returns an OIDC login URL that is bound to that transaction.
3. The bot stores the transaction id as pending login state.
4. After the user completes browser OIDC, AcornOps resolves the normal user identity, marks the chat transaction completed, and issues an opaque chat session token for bot API calls.
5. The user sends `status`, and the bot calls `GET /api/v1/auth/chat/mattermost/login/{id}`. If completed, the bot stores the AcornOps user metadata plus opaque chat session token and clears the pending state.

The chat session token is not the browser cookie. It should be scoped by AcornOps for bot/API use, revocable by AcornOps, and safe to store only in the bot's backend storage layer.

## kagent-Inspired Notes

Current kagent chatbot examples use the chat app as a thin adapter: Slack or Discord receives the message, forwards it to an A2A endpoint, and posts the backend agent response. kagent also models agents and sessions as backend-managed resources with observability and policy around the agent runtime.

For CSIT, that suggests:

- Mattermost identity and bot token stay in the Mattermost adapter.
- AcornOps identity, sessions, authorization, and cluster access stay in AcornOps.
- The adapter stores only the mapping and opaque token required to resume backend calls for a Mattermost user.
- Backend APIs should be explicit about transaction status instead of relying on browser cookies leaking across systems.

References checked on 2026-06-05:

- https://kagent.dev/docs/kagent/examples/slack-a2a
- https://kagent.dev/docs/kagent/examples/discord-a2a
- https://kagent.dev/docs/kagent/examples/a2a-agents
- https://kagent.dev/docs/kagent/concepts/architecture
