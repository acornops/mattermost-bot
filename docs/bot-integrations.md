# Mattermost Bot Integration Options

This note records the `L04` review of Mattermost integration styles for the CSIT ChatOps bot.

## Goal

Choose the first Mattermost integration style for a bot that authenticates Mattermost users to a backend system for managing Kubernetes clusters.

The backend API contract is still pending, so the first integration should be easy to run locally, preserve the invoking Mattermost user identity, and leave room for interactive authentication later.

## Options Reviewed

### Custom Slash Command

- Shape: A user types a command such as `/csit login` or `/csit clusters`; Mattermost sends an HTTP request to an external service.
- Strengths: Explicit user intent, good ChatOps ergonomics, works in public channels, private channels, and direct messages, and includes fields such as user, channel, team, command text, token, trigger ID, and response URL.
- Fit for CSIT: Best first prototype. Authentication and cluster-management actions should be explicit, auditable commands rather than passive keyword triggers.
- Local development notes: Run a small local HTTP service and configure the command request URL in Mattermost. Validate the slash command token on every request.

### Bot Account With Mattermost REST API

- Shape: A dedicated bot identity uses a personal access token to call the Mattermost REST API.
- Strengths: Good for durable bot identity, proactive follow-up messages, posting outside the immediate command response, and API actions such as direct messages or richer workflow state.
- Fit for CSIT: Useful companion to slash commands once the bot needs to send delayed messages, open follow-up conversations, or call Mattermost APIs. Do not start with a human admin token.
- Local development notes: Self-hosted Mattermost disables bot account creation by default unless enabled in integration settings, while plugins can still create and manage bot accounts.

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

Use a custom slash command as the first prototype integration style.

Pair it with a bot account and Mattermost REST API access only when the prototype needs durable bot identity, delayed responses beyond the command response URL, direct messages, or proactive posts.

Recommended first command namespace:

```text
/csit
```

Initial command shape to prototype later:

```text
/csit login
/csit status
/csit clusters
```

## Security Notes

- Validate the slash command token from Mattermost before processing requests.
- Treat the Mattermost `user_id` as the chat identity to map to the backend authentication flow.
- Prefer ephemeral responses for authentication status and sensitive prompts.
- Avoid human or System Admin personal access tokens for bot automation.
- Store integration secrets outside committed files.

## References Checked On 2026-05-26

- Mattermost Integrations Guide: https://docs.mattermost.com/integrations-guide/integrations-guide-index.html
- Mattermost Slash Commands guide: https://docs.mattermost.com/integrations-guide/slash-commands.html
- Custom slash command developer docs: https://developers.mattermost.com/integrate/slash-commands/custom/
- Mattermost Outgoing Webhooks guide: https://docs.mattermost.com/integrations-guide/outgoing-webhooks.html
- Mattermost webhook developer docs: https://developers.mattermost.com/integrate/webhooks/
- Mattermost integration configuration settings: https://docs.mattermost.com/administration-guide/configure/integrations-configuration-settings.html
- Deprecated Apps framework plugin repository: https://github.com/mattermost/mattermost-plugin-apps
