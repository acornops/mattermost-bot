# Mattermost Bot Commands

`@acorn-ops-bot` lets you inspect AcornOps workspaces and targets from Mattermost, then open a read-only troubleshooting chat for the target you selected.

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

After `!chat new`, the bot posts a dedicated Mattermost thread for that chat. Reply inside that thread to ask read-only AcornOps questions for the selected target. Thread replies do not need `!`. If the answer takes longer than the immediate response window, the bot posts the final answer in the same thread when AcornOps finishes.

Example:

```text
why is the development cluster unhealthy?
```

## Common Commands

| Command | What it does |
| --- | --- |
| `!help` | Shows the short command help in Mattermost. |
| `!help filters` | Shows commonly used filters and allowed values. |
| `!login` | Creates an AcornOps account-link URL. Use this in a direct message. |
| `!status` | Shows your link status and current bot context. |
| `!workspaces` | Lists AcornOps workspaces you can access and may include selection buttons. |
| `!workspace 1` | Selects a workspace from the latest `!workspaces` result. |
| `!workspace` | Shows the current workspace. |
| `!targets` | Lists Kubernetes and VM targets in the current workspace and may include selection buttons. |
| `!target 1` | Selects a target from the latest `!targets` result. |
| `!resources` | Lists resources for the selected target. |
| `!findings` | Lists findings for the selected target. |
| `!investigations` | Lists investigations in the current workspace. |
| `!chat new [title]` | Starts a new read-only troubleshooting chat and posts a Mattermost thread for it. |
| `!chat end` | Inside a chat thread, closes only that chat and stops following its active answer. |
| `!webhook connect` | Routes user-level AcornOps webhook alerts to the current Mattermost destination. |
| `!webhook status` | Shows your current webhook alert route. |
| `!webhook disconnect` | Removes your webhook alert route. |

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

### Findings

| Filter | Values | Example |
| --- | --- | --- |
| `q` | any search text | `!findings q=probe` |
| `severity` | `critical`, `warning`, `info` | `!findings severity=critical` |
| `namespace` | Kubernetes namespace | `!findings namespace=payments` |

Example:

```text
!findings severity=critical namespace=payments
```

### Investigations

| Filter | Values | Example |
| --- | --- | --- |
| `q` | any search text | `!investigations q=pod` |
| `severity` | `critical`, `warning`, `info` | `!investigations severity=warning` |
| `clusterId` | AcornOps cluster id | `!investigations clusterId=cluster-id` |
| `namespace` | Kubernetes namespace | `!investigations namespace=default` |

Example:

```text
!investigations severity=warning clusterId=cluster-id namespace=default
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

## Webhook Alerts

After AcornOps webhook intake is configured for the bot, users can route user-level alerts to Mattermost:

| Command | What it does |
| --- | --- |
| `!webhook connect` | Creates or rotates a delivery URL and signing secret for the current channel, direct message, or thread. Save the signing secret when it is shown. |
| `!webhook reconnect` | Rotates the delivery URL and signing secret. |
| `!webhook status` | Shows where alerts route and the delivery URL, but never shows the signing secret. |
| `!webhook disconnect` | Deletes your alert route and disables the delivery URL. |

AcornOps must send webhook deliveries to the route URL with `AcornOps-Event-Id`, `AcornOps-Timestamp`, and `AcornOps-Signature: v1=<hmac>`, where the HMAC is SHA-256 over `timestamp + "." + rawBody` using the signing secret from `!webhook connect`.

## Safety Notes

- The bot never asks you to type your AcornOps password into Mattermost.
- `!login` should be used in a direct message with the bot.
- Assistant chats are read-only.
- The bot cannot approve changes, cancel runs, rotate agent keys, manage targets, read logs, or call AcornOps admin/internal APIs.
- Channel responses are visible to the channel. Use a direct message for quieter troubleshooting.

## Troubleshooting

| Message | What to do |
| --- | --- |
| `not linked` | Direct-message the bot with `!login`, complete the browser link, then retry. |
| `Choose a workspace first` | Run `!workspaces`, then `!workspace 1`. |
| `Choose a target first` | Run `!targets`, then `!target 1`. |
| `not permitted` | Your AcornOps role or the bot integration does not allow that action. |
| `Commands use !` | Retry the command with `!`, such as `!help`. |
