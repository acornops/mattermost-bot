# Mattermost Bot Integration Options

This note records the `L04` review of Mattermost integration styles for the CSIT ChatOps bot.

## Goal

Choose the first Mattermost integration style for a bot that authenticates Mattermost users to a backend system for managing Kubernetes clusters.

The backend API contract is still pending, so the first integration should be easy to run locally, expose a stable bot identity that users can talk to, preserve the Mattermost user identity, and leave room for interactive authentication later.

## Options Reviewed

### Custom Slash Command

- Shape: A user types a command such as `/csit login` or `/csit clusters`; Mattermost sends an HTTP request to an external service.
- Strengths: Explicit user intent, good ChatOps ergonomics, works in public channels, private channels, and direct messages, and includes fields such as user, channel, team, command text, token, trigger ID, and response URL.
- Fit for CSIT: Useful later as a shortcut, but not the right first user experience. The user should talk to a named CSIT bot account instead of relying on a global slash command that appears to work in any chat.
- Local development notes: Run a small local HTTP service and configure the command request URL in Mattermost. Validate the slash command token on every request.

### Bot Account With Mattermost REST API And WebSocket Events

- Shape: A dedicated bot identity uses a bot access token to call the Mattermost REST API and listens for messages through Mattermost WebSocket `posted` events.
- Strengths: Good for durable bot identity, direct-message conversations, mentions in channels, proactive follow-up messages, and richer workflow state.
- Fit for CSIT: Best first prototype. Authentication should feel like a conversation with the CSIT bot account, and later backend login state can be tied to the human Mattermost user who messaged the bot.
- Local development notes: A bot account can be created through Mattermost tooling or APIs, then its generated token can call the REST API on behalf of that bot. Keep the token outside committed files.

### Outgoing Webhook

- Shape: Mattermost sends a request when a public-channel message matches trigger words or a configured channel.
- Strengths: Simple channel automation and keyword-triggered enrichment.
- Fit for CSIT: Not recommended as the first prototype because authentication commands should be explicit and outgoing webhooks are public-channel only.
- Local development notes: Could be useful later for passive status enrichment in public operations channels.

### Incoming Webhook

- Shape: External systems post messages into Mattermost.
- Strengths: Simple notifications from CI, backend jobs, or cluster events.
- Fit for CSIT: Useful later for backend-to-channel notifications, but it does not receive user commands and is not enough for the authentication workflow.

### Custom Plugin

- Shape: A Mattermost plugin extends server behavior in Go and can optionally add web-app UI in TypeScript/React.
- Strengths: Deep server integration, custom UI, lifecycle hooks, storage, and tight Mattermost behavior changes.
- Fit for CSIT: Too heavy for the first prototype. Revisit only if slash commands plus bot API calls cannot support the required user experience.

### Apps Framework

- Shape: Historically supported language-neutral interactive apps.
- Strengths: Attractive model for interactive workflows.
- Fit for CSIT: Do not choose for the first prototype. The `mattermost-plugin-apps` repository currently warns that it is deprecated and points developers back to current Mattermost integration solutions.

## Decision

Use a dedicated Mattermost bot account as the first prototype integration style.

The bot account should be created locally as `csit`, use a bot access token stored outside committed files, and respond to direct messages or channel mentions. Slash commands can be revisited later as optional shortcuts, but they are no longer the first product path.

Recommended first bot account:

```text
@csit
```

Initial message shape to prototype later:

```text
help
login
status
clusters
```

## Security Notes

- Treat the sender Mattermost `user_id` as the chat identity to map to the backend authentication flow.
- Prefer direct-message responses for authentication status and sensitive prompts.
- Post bot responses as normal channel messages unless the product explicitly needs threads.
- Avoid human or System Admin personal access tokens for bot automation.
- Store integration secrets outside committed files.
- Ignore messages authored by the bot itself to avoid reply loops.

## References Checked On 2026-05-28

- Mattermost Integrations Guide: https://docs.mattermost.com/integrations-guide/integrations-guide-index.html
- Mattermost Slash Commands guide: https://docs.mattermost.com/integrations-guide/slash-commands.html
- Custom slash command developer docs: https://developers.mattermost.com/integrate/slash-commands/custom/
- Mattermost Bot Accounts reference: https://developers.mattermost.com/integrate/reference/bot-accounts/
- Mattermost API documentation: https://developers.mattermost.com/api-documentation/
- Mattermost Outgoing Webhooks guide: https://docs.mattermost.com/integrations-guide/outgoing-webhooks.html
- Mattermost webhook developer docs: https://developers.mattermost.com/integrate/webhooks/
- Mattermost integration configuration settings: https://docs.mattermost.com/administration-guide/configure/integrations-configuration-settings.html
- Mattermost RESTful API guide: https://docs.mattermost.com/integrations-guide/restful-api.html
- Deprecated Apps framework plugin repository: https://github.com/mattermost/mattermost-plugin-apps
