# Bot Auth State

The bot does not own AcornOps authentication state.

AcornOps owns:

- short-lived Mattermost link tokens;
- browser session and OIDC authentication;
- durable Mattermost-to-AcornOps user links;
- link expiry, refresh, revocation, and audit behavior.

The bot owns only the chat interaction:

1. Read Mattermost server, team, and user ids from event or WebSocket context.
2. Call AcornOps `POST /api/v1/auth/chat/mattermost/link` for `login`.
3. Return the `linkUrl` exactly as AcornOps returned it.
4. Call AcornOps `POST /api/v1/auth/chat/mattermost/resolve` for `status`.
5. Report whether AcornOps says the identity is linked.

The bot must not store browser cookies, OIDC access tokens, ID tokens, refresh tokens, raw Mattermost link tokens, or bot-side AcornOps user ids.

The previous in-memory pending-login store and proposed transaction polling flow were removed after AcornOps added the durable account-link contract.
