# Standalone Mattermost Demo Deployment

## Boundary

This repository owns the demo-only Mattermost server, Mattermost Postgres,
bot Postgres, bot runtime, seeding, Docker lifecycle, ingress adapter, health
checks, backup, and application rollback.

The private `demo-infra` repository owns the shared VM, k3s, Traefik,
cert-manager, AcornOps platform, external-integration client registration, and
the deployment lease used to serialize mutations from both repositories.
Sharing one disposable VM is an operational convenience, not a security
boundary; Docker access is effectively host-root access.

## Topology

```text
Internet TCP 443
  -> k3s Traefik and cert-manager
     -> mattermost.demo.acornops.dev
        -> selectorless Service/EndpointSlice
           -> VM Docker port 8065
              -> Mattermost
     -> mattermost-bot.demo.acornops.dev
        -> selectorless Service/EndpointSlice
           -> VM Docker port 8077
              -> bot HTTP callbacks

Docker project: acornops-mattermost-demo
  Mattermost -> Mattermost Postgres
  bot -> bot Postgres
  bot -> Mattermost over the private Compose network
  bot -> https://api.demo.acornops.dev
```

The deploy script binds ports 8065 and 8077 only to Docker's private bridge
gateway. Provider and host firewalls must still expose 80 and 443 only.

Mattermost Calls are intentionally disabled. Supporting Calls would require a
separate UDP/TCP networking and capacity review.

## Prerequisites

- The two public DNS names resolve to the demo VM.
- The VM has Docker Engine and Docker Compose v2.
- k3s, Traefik, cert-manager, and the `letsencrypt-prod` ClusterIssuer are
  healthy.
- At least 4 GiB memory and 10 GiB disk are available before startup.
- `demo-infra` has registered the `mattermost-demo` external integration
  descriptor with the SHA-256 digest matching this deployment's raw token.
- `env/demo/.env.demo` exists with mode 0600 and contains URL-safe database
  passwords plus the required application secrets.

Run:

```bash
task demo:doctor
```

## Deployment

The GitHub Actions workflow is manual-only. It:

1. validates the repository;
2. uploads a commit-addressed release bundle;
3. acquires the shared demo VM deployment lease;
4. builds images before activation;
5. starts databases and Mattermost;
6. idempotently reconciles users, team, channel, bot, memberships, and token;
7. starts the bot;
8. applies the Traefik ingress adapter;
9. verifies private backends, public TLS, a real `!help` round trip, and
   AcornOps reachability;
10. records the release as current only after all checks pass.

For an operator-run deployment:

```bash
task demo:deploy
```

## Secrets

The raw external integration token, Mattermost action-signing key, database
passwords, and seeded passwords must stay in the protected deployment
environment. Only the external token's SHA-256 digest belongs in
`demo-infra`.

The Mattermost bot token is generated on the VM and stored in the shared
mode-0600 runtime file. It is never printed or committed.

## Verification

```bash
task demo:status
task demo:verify
task demo:logs
```

Automated verification proves service health, public TLS, the seeded command
round trip, and bot-to-AcornOps network reachability. Interactive acceptance
must also prove `!login`, `!status`, workspace and target selection, chat and
workflow streaming, buttons, approvals when granted, signed webhook delivery,
restart persistence, and idempotent redeployment.

## Backup And Rollback

Create a backup before every Mattermost version change:

```bash
task demo:backup
```

The backup briefly stops Mattermost and the bot, dumps both Postgres databases,
archives Mattermost configuration/data/plugin/index volumes, restarts the
applications, and writes a secret-free manifest.

Application deployment automatically attempts the previous commit-addressed
release when activation fails. It never deletes or rewinds persistent volumes.
Mattermost database or volume restoration is deliberately manual because it is
destructive and version-sensitive.

`task demo:down` stops containers while preserving volumes and ingress.
`task demo:reset` is destructive and deletes only the fixed Compose project's
volumes, generated bot token, and dedicated ingress namespace.

## Shared-VM Recovery

A platform-only demo-infra deployment should leave the Docker stack and
Mattermost ingress namespace intact. A full k3s teardown removes the ingress
adapter but not Docker volumes. After rebuilding k3s, rerun the Mattermost demo
deployment to restore Services, EndpointSlices, certificates, and Ingresses.
