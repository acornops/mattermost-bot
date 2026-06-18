# Bot Auth State

The bot does not own AcornOps authentication state.

AcornOps owns:

- short-lived external chat link tokens;
- browser session and OIDC authentication;
- durable external-chat-to-AcornOps user links;
- link expiry, refresh, revocation, and audit behavior.

The bot owns only the chat interaction:

1. Read the external user id from the Mattermost post or event author.
2. Call AcornOps `POST /api/v1/auth/chat/integration/link` for `login`.
3. Return the `linkUrl` exactly as AcornOps returned it.
4. Call AcornOps `POST /api/v1/auth/chat/integration/resolve` for `status`.
5. Report whether AcornOps says the identity is linked.

The bot must not store browser cookies, OIDC access tokens, ID tokens, refresh tokens, raw external chat link tokens, or bot-side AcornOps user ids.

The bot must not use ids typed by users in chat. The current AcornOps contract accepts only `externalUserId`; for the Mattermost adapter, that value is the observed Mattermost post author id.

The previous in-memory pending-login store and proposed transaction polling flow were removed after AcornOps added the durable account-link contract.
