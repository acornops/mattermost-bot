# Mattermost Bot Commands

`@acorn-ops-bot` lets you inspect AcornOps workspaces, targets, and issues; launch eligible workflows; receive alerts; and open troubleshooting chats from Mattermost. Chats are read-only by default; authorized users can explicitly request a permission-gated read-write chat.

Use plain messages with `!` before the command word. Do not use slash commands. Arguments stay unprefixed, such as `!chat new Investigate Pods`.

## Quick Start

Send these messages to the bot:

```text
!login
!workspaces
!workspace 1
!targets
!target 1
!chat new Investigate Pods
```

After `!chat new`, the bot posts a dedicated read-only Mattermost thread. Authorized users can instead use `!chat new --write [title]`; the bot checks the effective AcornOps workspace permission before creating a clearly labelled read-write thread. Thread replies do not need `!`.

If a write tool needs approval, the bot shows **Approve** and **Reject** to the Mattermost user who originated the run. Both choices open a confirmation dialog before the bot sends the decision to AcornOps. The bot continues watching and reports the decision and final result in the same thread. If interactive callbacks are not configured, it shows an AcornOps-console link instead.

Example:

```text
why is the development cluster unhealthy?
```

## Common Commands

| Command | What it does |
| --- | --- |
| `!help` | Shows the short command help in Mattermost. |
| `!help filters` | Shows commonly used filters and allowed values. |
| `!login` | Checks your AcornOps link and creates an account-link URL when relogin is needed. Use this in a direct message. |
| `!login reset` | Clears bot workspace, target, and chat/workflow thread context before creating a fresh account-link URL. |
| `!status` | Shows your link status and current bot context. |
| `!workspaces` | Lists AcornOps workspaces you can access and may include selection buttons. |
| `!workspace 1` | Selects a workspace from the latest `!workspaces` result. |
| `!workspace` | Shows the current workspace. |
| `!targets` | Lists Kubernetes and VM targets in the current workspace and may include selection buttons. |
| `!target 1` | Selects a target from the latest `!targets` result. |
| `!resources` | Lists resources for the selected target. |
| `!issues [filters]` | Lists issues across the current workspace. |
| `!workflows` | Lists eligible active workflows with read-only/read-write and approval labels. |
| `!workflow run <number\|id> [key=value...]` | Launches a workflow and creates a dedicated result thread. Quote values containing spaces. |
| `!chat new [title]` | Starts a new read-only troubleshooting chat and posts a Mattermost thread for it. |
| `!chat new --write [title]` | Starts a read-write chat only when the linked user, workspace grant, and integration configuration permit it. |
| `!chat end` | Inside a chat or workflow thread, closes that thread and stops following its active run. |
| `!webhook create` | Creates or shows your AcornOps delivery URL for the current Mattermost destination. |
| `!webhook connect` | Connects AcornOps console-created subscriptions for that delivery URL. |
| `!webhook status` | Shows your current webhook alert route and live AcornOps subscription state when available. |
| `!webhook recreate` | Rotates your delivery URL route token. Update the URL in AcornOps afterward. |
| `!webhook disconnect` | Removes your webhook alert route. |

## Workflow Threads

List and launch workflows after selecting a workspace:

```text
!workflows
!workflow run 1
```

Declared workflow inputs use `key=value`. Quote values containing spaces:

```text
!workflow run 1 reason="check production pods"
```

The bot validates current Workflow V2 `resourceRequirements`, renders declared inputs into the launch content, and replaces a target slot with the currently selected target's exact `@target[...]` reference. Required non-target placeholders such as `@chat[]` must be filled through the AcornOps console because Mattermost currently exposes only target selection. After AcornOps accepts the launch, the bot posts `**Workflow launched: <name>**` as a new Mattermost root post. Streamed results and plain-text follow-ups stay in that thread and use the same workflow session. The launch target is stored with the thread and reused in follow-up content even if the user's global target selection later changes.

Each workflow thread allows one active execution at a time. Read-only, read-write, and approval-gated workflows returned by AcornOps use the same launch syntax; AcornOps remains authoritative for eligibility. A follow-up starts a fresh execution in the same workflow session.

Every workflow launch or follow-up includes a hidden `clientRequestId` derived from the originating Mattermost post id. The bot also persists the initial post-to-workflow-session reservation, so sequential or concurrent delivery of that exact post reuses both the session and request id and AcornOps can return the same accepted execution. A new Mattermost reply gets a new id and execution.

Approval buttons are bound to the exact Mattermost user, run, approval, workspace, and thread through an expiring signed token. The action secret remains server-side and is never included in the post. The confirmation dialog carries a separate short-lived signed immutable state token, and AcornOps accepts decisions only from the same external integration link and client that created the execution. The bot never decides from an SSE event or webhook, never displays raw tool arguments, and may still offer rejection when write permission has been revoked and AcornOps permits it.

## Chat Threads

Start a chat thread with:

```text
!chat new
```

You can also provide a title:

```text
!chat new Investigate cluster health
```

The bot acknowledges the command, then posts a new root thread named like `Chat #1 - Investigate cluster health`. Reply in that thread with normal text to ask AcornOps questions for that chat. The main direct message or channel conversation remains available for commands like `!status`, `!resources`, `!workspaces`, or another `!chat new`.

The bot follows one active assistant response per chat thread. You can keep multiple chat threads open, but each thread accepts one active question at a time.

Use this command inside a chat thread:

| Command | What it does |
| --- | --- |
| `!chat end` | Closes the current Mattermost chat thread mapping and stops following any active answer for that thread. The session and run can still exist in the AcornOps UI. |

`!chat pause` and `!chat resume` are retired. They are no longer needed because normal bot commands happen in the main bot conversation while chat questions happen in chat threads.

If the bot process restarts while an answer is still running, the active run record remains in persistent state when Postgres is configured, but automatic resume of the SSE follower is not implemented yet. Use the AcornOps UI to inspect the session if a final Mattermost answer does not appear.

## Filters

Filters use `key=value` syntax.

### Workspaces

| Filter | Example |
| --- | --- |
| `q` | `!workspaces q=platform` |

### Targets

| Filter | Values | Example |
| --- | --- | --- |
| `q` | any search text | `!targets q=prod` |
| `targetType` | `kubernetes`, `virtual_machine` | `!targets targetType=kubernetes` |

### Resources

| Filter | Values | Example |
| --- | --- | --- |
| `q` | any search text | `!resources q=db` |
| `kind` | resource kind, such as `Pod` or `Deployment` | `!resources kind=Pod` |
| `family` | `workloads`, `network`, `storage`, `cluster` | `!resources family=workloads` |
| `namespace` | Kubernetes namespace | `!resources namespace=development` |
| `health` | `healthy`, `attention` | `!resources health=attention` |

Example:

```text
!resources kind=Pod namespace=development health=attention
```

### Issues

| Filter | Values | Example |
| --- | --- | --- |
| `q` | any search text | `!issues q=probe` |
| `status` | `active`, `recovering`, `resolved`, `all` | `!issues status=active` |
| `severity` | `critical`, `warning`, `info` | `!issues severity=critical` |
| `targetId` | AcornOps target id | `!issues targetId=target-id` |
| `targetType` | `kubernetes`, `virtual_machine` | `!issues targetType=kubernetes` |
| `namespace` | Kubernetes namespace | `!issues namespace=payments` |

Example:

```text
!issues status=active severity=critical targetType=kubernetes namespace=payments
```

## Shortcuts

The preferred target flow is `targets` and `target 1`, but these shortcuts are also available:

| Command | What it does |
| --- | --- |
| `!clusters` | Lists Kubernetes clusters in the current workspace. |
| `!clusters 1` | Shows cluster details without selecting it. |
| `!cluster 1` | Selects a Kubernetes cluster. |
| `!vms` | Lists VMs in the current workspace. |
| `!vms 1` | Shows VM details without selecting it. |
| `!vm 1` | Selects a VM. |

## Compatibility Commands

These commands still work, but most users should use chat threads instead:

| Command | What it does |
| --- | --- |
| `!sessions` | Lists assistant sessions for the selected target. |
| `!session new` | Creates a read-only assistant session. Prefer `!chat new`. |
| `!session 1` | Selects a session from the latest `!sessions` result. |
| `!messages` | Lists messages in the current session. |
| `!ask <question>` | Sends one read-only assistant question. Prefer a chat thread. |

## Command Aliases

| Command | What it does |
| --- | --- |
| `!filters` | Alias for `!help filters`. |

## Webhook Alerts

After AcornOps webhook intake is configured for the bot, users can route user-level alerts to Mattermost:

| Command | What it does |
| --- | --- |
| `!webhook create` | Creates or shows one delivery URL for the current channel, direct message, or thread. Paste this URL into the AcornOps console. |
| `!webhook connect` | Claims AcornOps subscription metadata and signing secrets after the URL is configured in AcornOps. |
| `!webhook recreate` | Rotates the delivery URL route token. Update the URL in AcornOps after using it. |
| `!webhook status` | Refreshes AcornOps subscription state, shows where alerts route, and never shows signing secrets. |
| `!webhook disconnect` | Deletes your alert route and disables the delivery URL. |

AcornOps must send webhook deliveries to the route URL with `AcornOps-Event-Id`, `AcornOps-Timestamp`, and `AcornOps-Signature: v1=<hmac>`, where the HMAC is SHA-256 over `timestamp + "." + rawBody` using a signing secret returned to the bot through AcornOps' authenticated connect API.

### Issue Alert Actions

Created and reopened Mattermost issue alerts include a **Run Triage** button when interactive actions are configured. This is an action on the Mattermost alert, not a webhook command. Only the Mattermost user who owns the alert route can use it. The bot reloads the issue before acting, links to recent AcornOps cluster chat activity when available, or creates a new read-only cluster session and streams the result into a dedicated Mattermost thread. Resolved issue alerts do not offer the action.

## Safety Notes

- The bot never asks you to type your AcornOps password into Mattermost.
- `!login` should be used in a direct message with the bot.
- Normal `!login` preserves bot context for same-account relogin. If the completed login uses a different AcornOps account, the bot resets context on the next authenticated command.
- Assistant chats are read-only by default. `!chat new --write` is available only when AcornOps grants the linked user effective read-write-run permission for the selected workspace.
- Read-write tools may require approval. The exact Mattermost user who started the run must confirm **Approve** or **Reject** before the bot sends that decision; AcornOps still enforces exact-origin authorization.
- The bot cannot decide automatically, cancel runs, rotate agent keys, manage targets, read logs, or call AcornOps admin/internal APIs.
- Channel responses are visible to the channel. Use a direct message for quieter troubleshooting.

## Troubleshooting

| Message | What to do |
| --- | --- |
| `not linked` | Direct-message the bot with `!login`, complete the browser link, then retry. |
| `Choose a workspace first` | Run `!workspaces`, then `!workspace 1`. |
| `Choose a target first` | Run `!targets`, then `!target 1`. |
| `not permitted` | Your AcornOps role or the bot integration does not allow that action. |
| `Commands use !` | Retry the command with `!`, such as `!help`. |
