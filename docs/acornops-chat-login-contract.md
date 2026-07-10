# AcornOps External Integration Account-Link Contract

This note records the current bot-facing AcornOps contract for external integration account linking.

## Current Endpoints

The CSIT bot uses only these AcornOps endpoints for account linking:

- `POST /api/v1/auth/external-integrations/link`
- `POST /api/v1/auth/external-integrations/resolve`

The bot must not call older transaction or polling endpoints.

## Bot Configuration

The bot needs:

```env
ACORNOPS_API_BASE_URL=http://localhost:8081
EXTERNAL_INTEGRATION_SERVICE_TOKEN=replace-with-external-integration-client-token
```

The token must match one SHA-256-hashed descriptor in the AcornOps control-plane `EXTERNAL_INTEGRATION_CLIENTS_JSON` configuration. The raw token must stay out of committed files, logs, docs, and API responses.

## Mattermost Identity

The request identity must come from the external chat event or WebSocket post author:

```json
{
  "externalUserId": "external-user-id-from-event",
  "externalDisplayName": "optional-display-name"
}
```

The bot must not accept external user ids typed by users in chat. For the
Mattermost adapter, use the Mattermost user id observed from the event or
websocket context as `externalUserId`.

`externalDisplayName` is optional and is sent only when the bot can derive it
from trusted Mattermost event metadata.

If the bot cannot determine the external user id without guessing, it should
not call AcornOps.

## Login

When the user sends `login` in a direct message, the bot calls:

```http
POST {ACORNOPS_API_BASE_URL}/api/v1/auth/external-integrations/link
Authorization: Bearer {EXTERNAL_INTEGRATION_SERVICE_TOKEN}
Content-Type: application/json
```

Body:

```json
{
  "externalUserId": "external-user-id",
  "externalDisplayName": "optional-display-name"
}
```

Successful response:

```json
{
  "linkUrl": "https://console.acornops.dev/integrations/external/link?token=intlink_...",
  "expiresAt": "2026-06-09T00:00:00.000Z"
}
```

Bot behavior:

- Resolve the current link first. If already linked, tell the user they are linked and do not create a new link URL.
- Return `linkUrl` exactly as AcornOps returns it.
- Tell the user the link expires in 10 minutes.
- Do not rewrite the link to a control-plane endpoint.
- Do not log the raw link URL or token in normal logs.
- When a link URL is returned, preserve existing bot context and mark login validation pending. The next authenticated command resolves once and clears context only if the AcornOps account fingerprint changed.

## Status

When the user sends `status`, the bot calls:

```http
POST {ACORNOPS_API_BASE_URL}/api/v1/auth/external-integrations/resolve
Authorization: Bearer {EXTERNAL_INTEGRATION_SERVICE_TOKEN}
Content-Type: application/json
```

Body:

```json
{
  "externalUserId": "external-user-id"
}
```

Linked response:

```json
{
  "status": "linked",
  "user": {
    "id": "acornops-user-id",
    "email": "user@example.com",
    "displayName": "User Name"
  },
  "link": {
    "integrationClientId": "client-id",
    "provider": "mattermost",
    "clientDisplayName": "Mattermost",
    "externalUserId": "external-user-id",
    "linkedAt": "2026-06-09T00:00:00.000Z",
    "lastAuthenticatedAt": "2026-06-09T00:00:00.000Z",
    "expiresAt": "2026-07-09T00:00:00.000Z"
  }
}
```

Unlinked response:

```json
{
  "status": "unlinked"
}
```

Bot behavior:

- For `linked`, report that the external chat user is linked to AcornOps.
- For `unlinked`, tell the user to run `login` in a direct message.

## Removed Placeholder Flow

The bot no longer:

- Calls `POST /api/v1/auth/chat/integration/login`.
- Calls `GET /api/v1/auth/chat/integration/login/{id}`.
- Calls the superseded `POST /api/v1/auth/chat/integration/link` or `POST /api/v1/auth/chat/integration/resolve` paths.
- Builds plain AcornOps OIDC login links.
- Stores bot-side AcornOps sessions or transaction-style login state.
- Mints or accepts bot-side AcornOps user ids.
- Stores browser sessions, OIDC tokens, refresh tokens, or raw external integration link tokens.
- Stores raw AcornOps user ids; account-switch detection uses a hash of AcornOps `user.id`.
