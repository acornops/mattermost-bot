# AcornOps Mattermost Account-Link Contract

This note records the current bot-facing AcornOps contract for Mattermost account linking.

## Current Endpoints

The CSIT bot uses only these AcornOps endpoints for account linking:

- `POST /api/v1/auth/chat/mattermost/link`
- `POST /api/v1/auth/chat/mattermost/resolve`

The browser handoff endpoint is owned by AcornOps:

- `GET /api/v1/auth/chat/mattermost/link/start?token=<mattermost-link-token>`

The bot must not call older transaction or polling endpoints.

## Bot Configuration

The bot needs:

```env
ACORNOPS_API_BASE_URL=http://localhost:8081
MATTERMOST_CHAT_SERVICE_TOKEN=replace-with-strong-secret
```

The token must match the AcornOps control-plane `MATTERMOST_CHAT_SERVICE_TOKEN`.

## Mattermost Identity

The request identity must come from the Mattermost event or WebSocket post author:

```json
{
  "mattermostUserId": "mattermost-user-id-from-event"
}
```

The bot must not accept Mattermost ids typed by users in chat. Use the
Mattermost user id observed from the event or websocket context. This contract
is scoped to a single Mattermost server where Mattermost user ids are unique
across teams.

If the bot cannot determine the Mattermost user id without guessing, it should
not call AcornOps.

## Login

When the user sends `login` or `/login` in a direct message, the bot calls:

```http
POST {ACORNOPS_API_BASE_URL}/api/v1/auth/chat/mattermost/link
Authorization: Bearer {MATTERMOST_CHAT_SERVICE_TOKEN}
Content-Type: application/json
```

Successful response:

```json
{
  "linkUrl": "https://console.acornops.dev/integrations/mattermost/link?token=mmlink_...",
  "expiresAt": "2026-06-09T00:00:00.000Z"
}
```

Bot behavior:

- Return `linkUrl` exactly as AcornOps returns it.
- Tell the user the link expires in 10 minutes.
- Do not rewrite the link to the control-plane start endpoint.
- Do not log the raw link URL or token in normal logs.

## Status

When the user sends `status` or `/status`, the bot calls:

```http
POST {ACORNOPS_API_BASE_URL}/api/v1/auth/chat/mattermost/resolve
Authorization: Bearer {MATTERMOST_CHAT_SERVICE_TOKEN}
Content-Type: application/json
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

- For `linked`, report that the Mattermost user is linked to AcornOps.
- For `unlinked`, tell the user to run `/login`.

## Removed Placeholder Flow

The bot no longer:

- Calls `POST /api/v1/auth/chat/mattermost/login`.
- Calls `GET /api/v1/auth/chat/mattermost/login/{id}`.
- Builds plain AcornOps OIDC login links.
- Stores bot-side login state or AcornOps sessions.
- Mints or accepts bot-side AcornOps user ids.
- Stores browser sessions, OIDC tokens, refresh tokens, or raw Mattermost link tokens.
