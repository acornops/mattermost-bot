# Mattermost Bot Commands

`@acorn-ops-bot` lets you inspect AcornOps workspaces and targets from Mattermost, then open a read-only troubleshooting chat for the target you selected.

Use plain messages. Do not use slash commands.

## Quick Start

Send these messages to the bot:

```text
login
workspaces
workspace 1
targets
target 1
chat new
```

After `chat new`, normal messages are treated as read-only AcornOps questions for the selected target. If the answer takes longer than the immediate response window, the bot posts it here when AcornOps finishes.

Example:

```text
why is the development cluster unhealthy?
```

## Common Commands

| Command | What it does |
| --- | --- |
| `help` | Shows the short command help in Mattermost. |
| `help filters` | Shows commonly used filters and allowed values. |
| `login` | Creates an AcornOps account-link URL. Use this in a direct message. |
| `status` | Shows your link status and current bot context. |
| `workspaces` | Lists AcornOps workspaces you can access. |
| `workspace 1` | Selects a workspace from the latest `workspaces` result. |
| `workspace` | Shows the current workspace. |
| `targets` | Lists Kubernetes and VM targets in the current workspace. |
| `target 1` | Selects a target from the latest `targets` result. |
| `resources` | Lists resources for the selected target. |
| `findings` | Lists findings for the selected target. |
| `investigations` | Lists investigations in the current workspace. |
| `chat new` | Starts a new read-only troubleshooting chat for the selected target. |
| `chat pause` | Leaves chat mode while keeping the current chat resumable. |
| `chat resume` | Resumes the latest paused chat. |
| `chat end` | Ends chat mode and clears the bot's current chat pointer. |

## Chat Mode

Chat mode starts with:

```text
chat new
```

You can also provide a title:

```text
chat new Investigate cluster health
```

While chat mode is active, normal text and command-looking text such as `status`, `resources`, and `findings` are sent to AcornOps as read-only assistant questions. Use `chat pause` before running normal bot commands.

The bot follows one active assistant response per user. If you send another question while AcornOps is still responding, the bot asks you to wait for that answer or use `chat end` to stop following it.

Use these commands to control chat mode:

| Command | What it does |
| --- | --- |
| `chat pause` | Leaves chat mode while keeping the current chat resumable. If an answer is already running, the bot still posts it when AcornOps finishes. Use this before running bot commands like `status`, `resources`, or `findings`. |
| `chat resume` | Re-enters the paused chat. |
| `chat end` | Clears the bot's current chat session pointer and stops following any active answer. The session and run can still exist in the AcornOps UI. |

If the bot process restarts while an answer is still running, the AcornOps run may complete but the bot will not post that final answer. Use the AcornOps UI to inspect the session.

## Filters

Filters use `key=value` syntax.

### Workspaces

| Filter | Example |
| --- | --- |
| `q` | `workspaces q=platform` |

### Targets

| Filter | Values | Example |
| --- | --- | --- |
| `q` | any search text | `targets q=prod` |
| `targetType` | `kubernetes`, `virtual_machine` | `targets targetType=kubernetes` |

### Resources

| Filter | Values | Example |
| --- | --- | --- |
| `q` | any search text | `resources q=db` |
| `kind` | resource kind, such as `Pod` or `Deployment` | `resources kind=Pod` |
| `family` | `workloads`, `network`, `storage`, `cluster` | `resources family=workloads` |
| `namespace` | Kubernetes namespace | `resources namespace=development` |
| `health` | `healthy`, `attention` | `resources health=attention` |

Example:

```text
resources kind=Pod namespace=development health=attention
```

### Findings

| Filter | Values | Example |
| --- | --- | --- |
| `q` | any search text | `findings q=probe` |
| `severity` | `critical`, `warning`, `info` | `findings severity=critical` |
| `namespace` | Kubernetes namespace | `findings namespace=payments` |

Example:

```text
findings severity=critical namespace=payments
```

### Investigations

| Filter | Values | Example |
| --- | --- | --- |
| `q` | any search text | `investigations q=pod` |
| `severity` | `critical`, `warning`, `info` | `investigations severity=warning` |
| `clusterId` | AcornOps cluster id | `investigations clusterId=cluster-id` |
| `namespace` | Kubernetes namespace | `investigations namespace=default` |

Example:

```text
investigations severity=warning clusterId=cluster-id namespace=default
```

## Shortcuts

The preferred target flow is `targets` and `target 1`, but these shortcuts are also available:

| Command | What it does |
| --- | --- |
| `clusters` | Lists Kubernetes clusters in the current workspace. |
| `clusters 1` | Shows cluster details without selecting it. |
| `cluster 1` | Selects a Kubernetes cluster. |
| `vms` | Lists VMs in the current workspace. |
| `vms 1` | Shows VM details without selecting it. |
| `vm 1` | Selects a VM. |

## Compatibility Commands

These commands still work, but most users should use chat mode instead:

| Command | What it does |
| --- | --- |
| `sessions` | Lists assistant sessions for the selected target. |
| `session new` | Creates a read-only assistant session. Prefer `chat new`. |
| `session 1` | Selects a session from the latest `sessions` result. |
| `messages` | Lists messages in the current session. |
| `ask <question>` | Sends one read-only assistant question. Prefer chat mode. |

## Safety Notes

- The bot never asks you to type your AcornOps password into Mattermost.
- `login` should be used in a direct message with the bot.
- Assistant chats are read-only.
- The bot cannot approve changes, cancel runs, rotate agent keys, manage targets, read logs, or call AcornOps admin/internal APIs.
- Channel responses are visible to the channel. Use a direct message for quieter troubleshooting.

## Troubleshooting

| Message | What to do |
| --- | --- |
| `not linked` | Direct-message the bot with `login`, complete the browser link, then retry. |
| `Choose a workspace first` | Run `workspaces`, then `workspace 1`. |
| `Choose a target first` | Run `targets`, then `target 1`. |
| `not permitted` | Your AcornOps role or the bot integration does not allow that action. |
| `Commands do not use /` | Retry the command without the slash. |
