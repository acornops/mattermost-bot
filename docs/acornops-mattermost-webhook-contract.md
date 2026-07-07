# AcornOps Mattermost Webhook Route Contract

## Purpose

Mattermost users need one reusable bot delivery URL that AcornOps can send signed event deliveries to. AcornOps remains the source of truth for workspace subscriptions, event selection, and webhook signing secrets. The Mattermost bot owns the delivery route, destination channel/thread, signature verification, idempotency, and Mattermost posting.

This contract is intended for AcornOps review before implementing or adjusting the control-plane endpoints.

## Delivery URL

The Mattermost bot generates one route URL per Mattermost user:

```text
https://<bot-public-base>/acornops/webhooks/routes/:routeToken
```

Production deployments must use HTTPS. Local development may explicitly allow localhost HTTP URLs only.

The route token identifies the Mattermost destination. It is not a signing secret.

## Console Setup

The AcornOps console should let a linked AcornOps user:

1. Paste the Mattermost bot delivery URL.
2. Select one or more workspaces.
3. Select event types or event groups.
4. Save AcornOps webhook subscriptions that deliver events to that URL.

AcornOps must enforce the browser user's normal workspace permissions, including `manage_webhooks` or the AcornOps-approved equivalent. The Mattermost external integration service token should not need broad webhook-management grants for setup.

## Bot Connect API

After console setup, the user runs `!webhook connect` in Mattermost. The bot calls AcornOps to claim subscription metadata and signing secrets for the configured delivery URL.

Proposed endpoint:

```http
POST /api/v1/external-integrations/webhook-routes/connect
Authorization: Bearer <EXTERNAL_INTEGRATION_SERVICE_TOKEN>
x-acornops-external-user-id: <mattermost-user-id>
Content-Type: application/json

{
  "deliveryUrl": "https://bot.example.com/acornops/webhooks/routes/route-token"
}
```

Response:

```json
{
  "status": "connected",
  "connectedAt": "2026-07-07T10:00:00.000Z",
  "lastSyncedAt": "2026-07-07T10:00:00.000Z",
  "subscriptions": [
    {
      "workspaceId": "workspace-1",
      "workspaceName": "Platform",
      "webhookId": "webhook-1",
      "eventTypes": ["run.failed.v1", "run.cancelled.v1"],
      "signingSecret": "whsec_generated_by_acornops",
      "enabled": true,
      "status": "enabled",
      "updatedAt": "2026-07-07T10:00:00.000Z"
    }
  ]
}
```

AcornOps must return only subscriptions for the linked AcornOps user that match the submitted delivery URL. Signing secrets are returned only during connect or documented rotation flows. The public Mattermost bot webhook listener must never receive setup secrets.

## Bot Status API

`!webhook status` should refresh live state from AcornOps before showing the user a status summary.

Proposed endpoint:

```http
GET /api/v1/external-integrations/webhook-routes/status?deliveryUrl=<url-encoded-delivery-url>
Authorization: Bearer <EXTERNAL_INTEGRATION_SERVICE_TOKEN>
x-acornops-external-user-id: <mattermost-user-id>
```

Response:

```json
{
  "status": "connected",
  "lastSyncedAt": "2026-07-07T10:05:00.000Z",
  "subscriptions": [
    {
      "workspaceId": "workspace-1",
      "workspaceName": "Platform",
      "webhookId": "webhook-1",
      "eventTypes": ["run.failed.v1", "target.status_changed.v1"],
      "enabled": true,
      "status": "enabled",
      "updatedAt": "2026-07-07T10:04:00.000Z"
    }
  ]
}
```

Status responses must not include signing secrets. The bot preserves previously claimed secrets locally and uses the live AcornOps status only for current workspace/event/enabled state.

## Event Delivery

AcornOps sends events to the bot route URL:

```http
POST /acornops/webhooks/routes/:routeToken
AcornOps-Event-Id: evt_123
AcornOps-Timestamp: 1783428000
AcornOps-Signature: v1=<hmac_sha256(secret, timestamp + "." + rawBody)>
Content-Type: application/json
```

The bot verifies:

- route token hash lookup;
- timestamp freshness;
- HMAC SHA-256 signature over the raw request body;
- event id presence;
- duplicate event suppression.

## Security Requirements

- Production AcornOps API and bot public URLs must use TLS.
- Signing secrets must not be embedded in URLs.
- Signing secrets must not be sent to the public bot listener.
- Route tokens identify destinations; HMAC secrets authenticate AcornOps deliveries.
- Status APIs must not reveal signing secrets.
- Connect/claim semantics must be one-time or have documented rotation behavior.
