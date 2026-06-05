# AcornOps Mattermost Chat Login Contract

This brief is for agents working in `/Users/ryangoh/Desktop/Development/acornops/control-plane`.

## Goal

Implement the missing AcornOps backend contract that lets the CSIT Mattermost bot link a Mattermost user to the AcornOps user who completed browser OIDC.

The CSIT bot already supports this contract:

- `POST /api/v1/auth/chat/mattermost/login`
- `GET /api/v1/auth/chat/mattermost/login/{id}`

Until AcornOps implements those endpoints, `B04` remains blocked because the bot cannot prove which AcornOps user completed browser login.

## Existing AcornOps Context

Checked in the AcornOps control-plane checkout:

- Runtime app wiring: `src/app.ts`
- Auth routes: `src/routes/auth.ts`
- Auth controller: `src/controllers/auth-controller.ts`
- OIDC state and callback helpers: `src/auth/oidc.ts`
- Browser session helpers: `src/auth/session.ts`
- Auth middleware and service-token helpers: `src/auth/middleware.ts`
- Redis client: `src/infra/redis.ts`
- Config schema: `src/config.ts`
- Auth tests: `test/auth-config.test.ts`, `test/auth-session.test.ts`, `test/auth-controller-regression.test.ts`
- OpenAPI auth paths: `src/docs/openapi/auth-paths.ts`

AcornOps already stores OIDC state in Redis under `cp:oidc:state:{state}` and creates browser sessions with the `acornops_cp_session` cookie. The chat login contract should reuse that pattern: Redis for short-lived transaction state, and AcornOps-owned user/session issuance after normal OIDC succeeds.

## Trust Boundary

Do not let the CSIT bot decide or assert the AcornOps user identity.

The bot may say:

- I am the registered Mattermost bot.
- Mattermost user `mm-user-id` asked to log in.
- Please create or check a chat login transaction.

Only AcornOps may say:

- OIDC succeeded.
- The authenticated AcornOps user is `acorn-user-id`.
- This Mattermost user is now linked to that AcornOps user.
- The bot may use this opaque chat-scoped credential or actor reference.

Do not return the raw browser `acornops_cp_session` cookie to the bot.

## Configuration

Add an AcornOps-side integration secret, for example:

```env
MATTERMOST_CHAT_SERVICE_TOKEN=replace-with-strong-secret
```

The CSIT bot will be started with the matching value:

```env
CSIT_ACORNOPS_CHAT_SERVICE_TOKEN=replace-with-strong-secret
```

Use AcornOps config parsing and production-secret validation conventions from `src/config.ts`. In production, reject placeholder or short values just like the existing service/admin tokens.

## Required Endpoints

### Create Login Transaction

`POST /api/v1/auth/chat/mattermost/login`

Auth:

- `Authorization: Bearer {MATTERMOST_CHAT_SERVICE_TOKEN}`
- This is service authentication for the bot, not a user browser session.

Request:

```json
{
  "mattermostUserId": "mm-user-id",
  "mattermostUserName": "alice",
  "returnTo": "/api/v1/auth/chat/mattermost/complete"
}
```

Validation:

- `mattermostUserId`: required non-empty string, bounded length.
- `mattermostUserName`: optional bounded string.
- `returnTo`: optional bounded string. Sanitize using the same rules as OIDC `return_to`; relative paths are preferred.

Response:

```json
{
  "id": "chat-login-id",
  "loginUrl": "http://localhost:8081/api/v1/auth/oidc/login?...",
  "expiresAt": "2026-06-05T00:10:00.000Z"
}
```

Storage:

- Store pending state in Redis with a short TTL, probably 10 minutes.
- Suggested key: `cp:chat_login:mattermost:{id}`.
- Store at least:
  - `id`
  - `provider: "mattermost"`
  - `mattermostUserId`
  - `mattermostUserName`
  - `status: "pending"`
  - `createdAt`
  - `expiresAt`
  - optional `returnTo`

OIDC binding:

- The returned `loginUrl` must start normal AcornOps OIDC login.
- The AcornOps OIDC state must remember the chat login transaction id.
- Preferred implementation: extend `src/auth/oidc.ts` state records with `purpose: "chat_login"` or `chatLoginId`.
- Avoid relying only on a query string carried through `return_to`; bind the transaction inside AcornOps-controlled OIDC state.

### Check Login Transaction

`GET /api/v1/auth/chat/mattermost/login/{id}`

Auth:

- `Authorization: Bearer {MATTERMOST_CHAT_SERVICE_TOKEN}`

Pending response:

```json
{
  "id": "chat-login-id",
  "status": "pending",
  "expiresAt": "2026-06-05T00:10:00.000Z"
}
```

Completed response:

```json
{
  "id": "chat-login-id",
  "status": "completed",
  "user": {
    "id": "acorn-user-id",
    "displayName": "Alice",
    "email": "alice@example.com"
  },
  "session": {
    "token": "opaque-chat-session-token",
    "expiresAt": "2026-06-05T01:00:00.000Z"
  }
}
```

Expired response:

```json
{
  "id": "chat-login-id",
  "status": "expired"
}
```

Security behavior:

- Unknown, expired, or already-consumed transaction ids must not reveal user identity.
- Decide whether completed transactions are single-use. Single-use is safer; if so, the first completed read should consume or rotate the transaction.
- Do not expose browser cookies, OIDC access tokens, ID tokens, or refresh tokens.

## OIDC Callback Changes

In `src/controllers/auth-controller.ts`, after `exchangeCodeForUser()` and normal `repo.resolveOidcLogin()` succeed:

1. Create the normal browser session as AcornOps already does.
2. If the OIDC state is bound to a Mattermost chat login transaction:
   - Load the pending Redis transaction.
   - Verify it is still pending and unexpired.
   - Mark it completed with the resolved AcornOps user id and public user metadata.
   - Issue an AcornOps-owned chat credential or actor reference for the bot.
   - Keep the normal browser redirect behavior.

Important: completion must happen only after normal OIDC validation and AcornOps user resolution succeed. Error paths such as missing email, unverified email, account-link-required, invalid state, and expired OIDC state must not complete a chat transaction.

## Credential Model

Preferred for this stage:

- Return an opaque chat-scoped token in the completed transaction.
- The token is not the browser cookie.
- The token should have expiry, revocation, auditability, and a narrow audience/scope for bot API use.

Acceptable alternative:

- The bot uses `MATTERMOST_CHAT_SERVICE_TOKEN` for future requests and includes the linked AcornOps user id or link id as an actor.
- AcornOps validates the link server-side and audits actions as `user via Mattermost bot`.

Avoid:

- Giving the bot the raw `acornops_cp_session` browser cookie.
- Letting the bot create arbitrary `mattermostUserId -> acornopsUserId` mappings without OIDC callback proof.
- Trusting a user-provided AcornOps user id from Mattermost chat text.

## Durable Identity Link

For the first implementation, the completed Redis transaction may be enough to unblock CSIT's `login` plus `status` smoke.

For production behavior, add durable storage for the long-lived link:

```text
provider = "mattermost"
mattermost_user_id
mattermost_team_id or instance_id, if available
acornops_user_id
linked_at
last_used_at
revoked_at
```

This prevents every bot restart from requiring a new OIDC login and gives AcornOps an audit/revocation surface.

## CSIT Bot Expectations

The CSIT bot currently behaves as follows:

1. User sends `login` in a direct message to `@acorn-ops-bot`.
2. If `CSIT_ACORNOPS_CHAT_SERVICE_TOKEN` is set, the bot calls `POST /api/v1/auth/chat/mattermost/login`.
3. Bot stores the returned transaction id as pending state.
4. User completes the returned browser OIDC URL.
5. User sends `status`.
6. Bot calls `GET /api/v1/auth/chat/mattermost/login/{id}`.
7. If status is `completed`, bot stores the returned AcornOps user metadata and opaque chat session token.

If AcornOps returns `404` or the endpoint is missing, CSIT falls back to a plain OIDC link and keeps the login honestly pending.

## Tests To Add In AcornOps

Add focused tests before or alongside implementation:

- Creating a Mattermost chat login requires the service token.
- Creating a transaction rejects missing or invalid `mattermostUserId`.
- Creating a transaction stores Redis state with TTL and returns a login URL bound to OIDC state.
- OIDC callback does not complete a transaction on invalid state, expired state, missing email, unverified email, or account-link-required.
- Successful OIDC callback completes the matching transaction with the resolved AcornOps user.
- Polling a pending transaction returns `pending`.
- Polling a completed transaction returns user metadata and an opaque chat credential or actor reference.
- Unknown, expired, or consumed transaction ids do not reveal identity.
- Browser session cookie behavior remains unchanged for normal OIDC login.
- OpenAPI generation and contract checks include the new paths if public docs expose them.

## Verification For AcornOps Agents

Run the AcornOps repo's normal validation command after implementation:

```sh
npm run validate
```

If that is too broad during iteration, at minimum run:

```sh
npm test
npm run typecheck
npm run openapi:check
```

Then verify from CSIT:

```sh
cd /Users/ryangoh/Desktop/Development/csit
./init.sh
```

With AcornOps running locally on `http://localhost:8081`, run a live smoke:

1. Start AcornOps with `MATTERMOST_CHAT_SERVICE_TOKEN` configured.
2. Start CSIT bot with matching `CSIT_ACORNOPS_CHAT_SERVICE_TOKEN`.
3. Direct-message `@acorn-ops-bot` with `login`.
4. Complete browser OIDC.
5. Direct-message `status`.
6. Confirm the bot reports `Backend authentication: connected as ...`.

## Done Criteria

This contract is complete when:

- AcornOps owns the proof that browser OIDC user X is linked to Mattermost user Y.
- CSIT no longer needs to pretend a plain OIDC browser link is enough for identity completion.
- The bot can store and use a backend-issued opaque chat credential or actor reference.
- Raw browser cookies never leave AcornOps browser-session handling.
- AcornOps tests and CSIT `./init.sh` pass.
