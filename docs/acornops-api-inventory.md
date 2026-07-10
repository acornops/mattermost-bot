# AcornOps API Inventory

Initially checked on 2026-06-04 against `/Users/ryangoh/Desktop/Development/acornops/control-plane`.

This inventory is a maintained reference for CSIT bot work. The account-link section was updated on 2026-06-23 from the current AcornOps external integration contract.

Do not implement bot behavior from the superseded proposal that used chat-login transactions or bot-side AcornOps session state. The current bot contract is recorded in `docs/acornops-chat-login-contract.md`.

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
- `POST /api/v1/auth/external-integrations/link`
- `POST /api/v1/auth/external-integrations/resolve`
- `POST /api/v1/auth/external-integrations/revoke`
- `POST /api/v1/auth/external-integrations/link/preview`
- `POST /api/v1/auth/external-integrations/link/complete`
- `GET /api/v1/auth/external-integrations/links`
- `POST /api/v1/auth/external-integrations/links/unlink`
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

## External Integration Account Linking

The older proposed Mattermost chat-login transaction flow has been superseded. The bot no longer creates AcornOps OIDC URLs, stores transaction-style pending login state, polls transaction ids, or receives AcornOps session tokens. The Mattermost bot may store a lightweight login-validation-pending flag and hashed AcornOps account fingerprint to protect command context across relogin.

The CSIT bot exposes `login` in Mattermost. That command calls AcornOps to create a short-lived external integration browser link:

- `POST /api/v1/auth/external-integrations/link`
  - Auth: `Authorization: Bearer {EXTERNAL_INTEGRATION_SERVICE_TOKEN}`.
  - Content type: `application/json`.
  - Request: `{ "externalUserId": "external-user-id-from-event", "externalDisplayName": "optional-display-name" }`.
  - Response: `{ "linkUrl": "...", "expiresAt": "..." }`.
  - Bot behavior: return `linkUrl` exactly as AcornOps sends it, tell the user it expires in 10 minutes, and do not log the raw link or token.

The browser opens the returned management-console URL:

- `/integrations/external/link?token=<external-integration-link-token>`
  - Auth: browser session or OIDC flow as needed.
  - Behavior: the console preserves the token through sign-in, previews safe consent metadata with `POST /api/v1/auth/external-integrations/link/preview`, and completes linking only after the signed-in user approves through `POST /api/v1/auth/external-integrations/link/complete`.

The CSIT bot exposes `status` in Mattermost. That command calls AcornOps to resolve the durable link:

- `POST /api/v1/auth/external-integrations/resolve`
  - Auth: `Authorization: Bearer {EXTERNAL_INTEGRATION_SERVICE_TOKEN}`.
  - Content type: `application/json`.
  - Request: `{ "externalUserId": "external-user-id-from-event" }`.
  - Response: `{ "status": "linked", ... }` or `{ "status": "unlinked" }`.
  - Linked response includes AcornOps user metadata and link timestamps.
  - Bot behavior: report linked AcornOps identity for `linked`; tell the user to run `login` in a direct message for `unlinked`.

The resolve request body intentionally includes only `externalUserId`. Link creation may also include optional `externalDisplayName` for consent metadata. The Mattermost adapter must set external identity values from the Mattermost event or WebSocket post author, never from user-supplied chat text.

AcornOps owns browser handoff, OIDC/session authentication, link token validation, link expiry, refresh/revocation policy, audit behavior, and the durable external-integration-to-AcornOps user link.
