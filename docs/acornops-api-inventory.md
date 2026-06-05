# AcornOps API Inventory

Checked on 2026-06-04 against `/Users/ryangoh/Desktop/Development/acornops/control-plane`.

## Source Files

- Runtime route mounting: `src/app.ts`
- Auth routes: `src/routes/auth.ts`
- Workspace routes: `src/routes/workspaces/*.ts`
- Sessions/runs routes: `src/routes/sessions.ts` and `src/routes/runs.ts`
- OpenAPI route source: `src/docs/openapi/*-paths.ts`

The AcornOps OpenAPI export script exists, but the sibling checkout does not currently have `node_modules` installed. This inventory was read from the same route and OpenAPI source files instead of installing dependencies into the sibling repository.

## Auth And Sessions

AcornOps user authentication is browser-session based. User requests authenticate with the `acornops_cp_session` cookie; bearer tokens are not accepted as normal user login.

Current auth endpoints:

- `GET /api/v1/auth/config`
- `GET /api/v1/auth/csrf`
- `GET /api/v1/auth/oidc/login`
- `GET /api/v1/auth/oidc/callback`
- `POST /api/v1/auth/oidc/link/start`
- `POST /api/v1/auth/password/login`
- `POST /api/v1/auth/password/signup`
- `POST /api/v1/auth/password/verify-email`
- `POST /api/v1/auth/password/resend-verification`
- `POST /api/v1/auth/password/forgot`
- `POST /api/v1/auth/password/reset`
- `POST /api/v1/auth/password/change`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/dev-login` in non-production only
- `GET /api/v1/me`
- `GET /api/v1/auth/methods`
- `GET /api/v1/auth/jwks.json`

OIDC state and AcornOps user sessions are Redis-backed in the control plane. `GET /api/v1/auth/oidc/login?return_to=...` starts the browser flow. The callback creates the AcornOps browser session cookie and redirects to a sanitized `return_to` URL.

## Public Product API

Workspace and membership:

- `GET|POST /api/v1/workspaces`
- `GET|DELETE /api/v1/workspaces/{workspaceId}`
- `GET /api/v1/workspaces/{workspaceId}/roles`
- `GET|POST /api/v1/workspaces/{workspaceId}/members`
- `PATCH|DELETE /api/v1/workspaces/{workspaceId}/members/{userId}`
- `GET /api/v1/workspaces/{workspaceId}/audit-log`
- `GET|POST /api/v1/workspaces/{workspaceId}/invitations`
- `DELETE /api/v1/workspaces/{workspaceId}/invitations/{invitationId}`
- `GET /api/v1/workspace-invitations/{token}`
- `POST /api/v1/workspace-invitations/{token}/accept`
- `GET /api/v1/workspaces/{workspaceId}/investigations`

Kubernetes clusters:

- `GET|POST /api/v1/workspaces/{workspaceId}/kubernetes-clusters`
- `GET|PATCH|DELETE /api/v1/workspaces/{workspaceId}/kubernetes-clusters/{clusterId}`
- `GET /api/v1/workspaces/{workspaceId}/kubernetes-clusters/metrics/history`
- `GET /api/v1/workspaces/{workspaceId}/kubernetes-clusters/{clusterId}/metrics/history`
- `GET /api/v1/workspaces/{workspaceId}/kubernetes-clusters/{clusterId}/tools/catalog`
- `GET /api/v1/workspaces/{workspaceId}/kubernetes-clusters/{clusterId}/resources`
- `GET /api/v1/workspaces/{workspaceId}/kubernetes-clusters/{clusterId}/findings`
- `GET /api/v1/workspaces/{workspaceId}/kubernetes-clusters/{clusterId}/pods/{namespace}/{podName}/logs`
- `POST /api/v1/workspaces/{workspaceId}/kubernetes-clusters/{clusterId}/rotate-agent-key`

Generic targets and MCP:

- `GET /api/v1/workspaces/{workspaceId}/targets`
- `GET /api/v1/workspaces/{workspaceId}/targets/{targetId}`
- `GET /api/v1/workspaces/{workspaceId}/targets/{targetId}/tools/catalog`
- `PATCH /api/v1/workspaces/{workspaceId}/targets/{targetId}/tools/{toolName}`
- `GET|POST /api/v1/workspaces/{workspaceId}/targets/{targetId}/mcp/servers`
- `GET|PATCH|DELETE /api/v1/workspaces/{workspaceId}/targets/{targetId}/mcp/servers/{serverId}`
- `POST /api/v1/workspaces/{workspaceId}/targets/{targetId}/mcp/servers/{serverId}/test-connection`
- `GET /api/v1/workspaces/{workspaceId}/targets/{targetId}/mcp/servers/{serverId}/tools`

Virtual machines:

- `GET|POST /api/v1/workspaces/{workspaceId}/virtual-machines`
- `GET|PATCH|DELETE /api/v1/workspaces/{workspaceId}/virtual-machines/{vmId}`
- `POST /api/v1/workspaces/{workspaceId}/virtual-machines/{vmId}/rotate-agent-key`
- `GET /api/v1/workspaces/{workspaceId}/virtual-machines/{vmId}/resources`
- `GET /api/v1/workspaces/{workspaceId}/virtual-machines/{vmId}/findings`
- `GET /api/v1/workspaces/{workspaceId}/virtual-machines/{vmId}/metrics/history`
- `GET /api/v1/workspaces/{workspaceId}/virtual-machines/{vmId}/logs`

Webhooks:

- `GET|POST /api/v1/workspaces/{workspaceId}/webhooks`
- `GET|PATCH|DELETE /api/v1/workspaces/{workspaceId}/webhooks/{webhookId}`
- `GET /api/v1/workspaces/{workspaceId}/webhooks/{webhookId}/history`

Troubleshooting sessions and runs:

- `GET|POST /api/v1/workspaces/{workspaceId}/targets/{targetId}/sessions`
- `GET /api/v1/workspaces/{workspaceId}/targets/{targetId}/chat-activity`
- `GET|POST /api/v1/workspaces/{workspaceId}/kubernetes-clusters/{clusterId}/sessions`
- `GET|DELETE /api/v1/sessions/{sessionId}`
- `GET|POST /api/v1/sessions/{sessionId}/messages`
- `GET /api/v1/runs/{runId}`
- `GET /api/v1/runs/{runId}/approvals`
- `POST /api/v1/runs/{runId}/approvals/{approvalId}/decision`
- `POST /api/v1/runs/{runId}/cancel`
- `GET /api/v1/runs/{runId}/stream`
- `GET /api/v1/runs/{runId}/events`

Health and local docs:

- `GET /health`
- `GET /ready`
- `GET /metrics`
- `GET /openapi.json` when API docs are enabled
- `GET /docs` when API docs are enabled

## Admin And Internal API

Admin endpoints exist under `/admin/v1` when `CONTROL_PLANE_ADMIN_API_ENABLED=true`. They use admin bearer tokens, not user sessions:

- `GET /admin/v1/me`
- `GET /admin/v1/system/readiness`
- `GET /admin/v1/system/config`
- `GET /admin/v1/workspaces`
- `GET /admin/v1/workspaces/{workspaceId}`
- `PATCH /admin/v1/workspaces/{workspaceId}/plan`
- `PATCH /admin/v1/workspaces/{workspaceId}/quotas`
- `GET /admin/v1/users`
- `GET /admin/v1/users/{userId}`
- `POST /admin/v1/users/{userId}/sessions/revoke`
- `GET|POST /admin/v1/workspaces/{workspaceId}/members`
- `PATCH /admin/v1/workspaces/{workspaceId}/members/{userId}/role`
- `DELETE /admin/v1/workspaces/{workspaceId}/members/{userId}`
- `GET /admin/v1/targets`
- `GET /admin/v1/targets/{targetId}/agent`
- `POST /admin/v1/targets/{targetId}/agent/disconnect`
- `POST /admin/v1/targets/{targetId}/agent-key/rotate`
- `GET /admin/v1/runs`
- `GET /admin/v1/runs/{runId}`
- `POST /admin/v1/runs/{runId}/cancel`
- `POST /admin/v1/runs/{runId}/mark-failed`
- `POST /admin/v1/tooling/sync`
- `GET /admin/v1/admin-audit-events`
- `GET /admin/v1/audit-events`

Internal execution endpoints exist under `/internal/v1` when internal transport TLS is not enabled. They are service-token or gateway-run-token protected and are not a Mattermost user login surface.

## Proposed Mattermost Chat Login Contract

There is currently no AcornOps endpoint that accepts a Mattermost pending-login id, returns the authenticated AcornOps user for that Mattermost user, or calls a bot completion URL after OIDC callback.

That means CSIT can safely generate the AcornOps OIDC browser link and track pending chat login state, but it cannot honestly mark a Mattermost user as linked after browser login unless AcornOps owns a completion signal.

The CSIT bot now has client-side support for this preferred AcornOps-owned API shape:

- `POST /api/v1/auth/chat/mattermost/login`
  - Auth: service bearer token for the bot, not a user browser session.
  - Request: `{ "mattermostUserId": "...", "mattermostUserName": "...", "returnTo": "..." }`
  - Response: `{ "id": "chat-login-id", "loginUrl": "https://...", "expiresAt": "..." }`
  - AcornOps stores the pending transaction in Redis or durable storage with a short TTL.
- `GET /api/v1/auth/chat/mattermost/login/{id}`
  - Auth: same service bearer token.
  - Pending response: `{ "id": "...", "status": "pending", "expiresAt": "..." }`
  - Completed response: `{ "id": "...", "status": "completed", "user": { "id": "...", "displayName": "..." }, "session": { "token": "opaque-chat-session-token", "expiresAt": "..." } }`
  - Expired or consumed transactions should not reveal user identity.

The OIDC callback path should complete the transaction only after normal `resolveOidcLogin()` succeeds. The bot should store the returned opaque chat session token and AcornOps user metadata, but it should not receive or store the browser `acornops_cp_session` cookie.

This mirrors the useful part of kagent's chatbot architecture: chat providers are thin adapters that keep platform tokens locally, invoke a backend agent/API over a stable protocol, and let backend-owned identity/session state remain backend-owned.
