export function formatWorkspacePage({ page, context, userId, userName }) {
  const items = Array.isArray(page?.items) ? page.items : [];
  if (items.length === 0) {
    return [
      ...formatContextLines(context, { userId, userName }),
      "AcornOps workspaces:",
      "- No workspaces are available for this linked account."
    ].join("\n");
  }

  const lines = [
    ...formatContextLines(context, { userId, userName }),
    "AcornOps workspaces:"
  ];

  for (const [index, workspace] of items.entries()) {
    lines.push(`${index + 1}. ${formatWorkspaceSummary(workspace)}`);
  }

  if (page.nextCursor) {
    lines.push(`Next page cursor: ${page.nextCursor}`);
  }

  lines.push("Use `!workspaces 1` for details or `!workspace 1` to set the current workspace.");

  return lines.join("\n");
}

export function formatWorkspaceDetail({ workspace, context, userId, userName, selectCurrent, currentPrefix }) {
  const lines = [
    ...formatContextLines(context, { userId, userName }),
    currentPrefix ? "Current AcornOps workspace:" : "AcornOps workspace:",
    `- Name: ${workspace.name ?? workspace.displayName ?? workspace.slug ?? "Unnamed workspace"}`,
    `- ID: ${workspace.id ?? "unknown"}`
  ];

  const plan = workspace.plan?.name ?? workspace.plan?.key ?? "";
  if (plan) {
    lines.push(`- Plan: ${plan}`);
  }

  const permissions = formatPermissions(workspace.permissions);
  if (permissions) {
    lines.push(`- Permissions: ${permissions}`);
  }

  const counts = formatCounts(workspace.counts ?? workspace.listCounts ?? workspace.boundedListCounts);
  if (counts) {
    lines.push(`- Counts: ${counts}`);
  }

  const quota = formatWorkspaceQuota(workspace.quota);
  if (quota) {
    lines.push(`- Quota: ${quota}`);
  }

  if (selectCurrent) {
    lines.push("Current workspace updated. Use `!targets` to choose what to inspect.");
  } else if (!currentPrefix) {
    lines.push("Use `!workspace 1` to make this the current workspace.");
  } else {
    lines.push("Use `!targets` to choose what to inspect in this workspace.");
  }
  return lines.join("\n");
}

function formatWorkspaceSummary(workspace) {
  const name = workspace.name ?? workspace.displayName ?? workspace.slug ?? workspace.id ?? "Unnamed workspace";
  const id = workspace.id && workspace.id !== name ? ` (${workspace.id})` : "";
  const plan = workspace.plan?.name ?? workspace.plan?.key ?? "";
  const quota = formatWorkspaceQuota(workspace.quota);
  const parts = [`${name}${id}`];

  if (plan) {
    parts.push(`plan: ${plan}`);
  }
  if (quota) {
    parts.push(`quota: ${quota}`);
  }

  return parts.join(" | ");
}

function formatWorkspaceQuota(quota) {
  if (!quota || typeof quota !== "object") {
    return "";
  }

  return [
    formatQuotaValue("members", quota.members),
    formatQuotaValue("clusters", quota.kubernetesClusters),
    formatQuotaValue("VMs", quota.virtualMachines)
  ].filter(Boolean).join(", ");
}

function formatPermissions(permissions) {
  if (!permissions || typeof permissions !== "object") {
    return "";
  }

  const enabled = Object.entries(permissions)
    .filter(([, value]) => value === true)
    .map(([key]) => key);

  return enabled.length > 0 ? enabled.join(", ") : "none";
}

function formatCounts(counts) {
  if (!counts || typeof counts !== "object") {
    return "";
  }

  return Object.entries(counts)
    .filter(([, value]) => typeof value === "number" || typeof value === "string")
    .map(([key, value]) => `${key} ${value}`)
    .join(", ");
}

export function formatClusterPage({ page, context, userId, userName }) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const lines = [
    ...formatContextLines(context, { userId, userName }),
    "AcornOps clusters:"
  ];

  if (items.length === 0) {
    lines.push("- No clusters are available in this workspace.");
    return lines.join("\n");
  }

  for (const [index, cluster] of items.entries()) {
    lines.push(`${index + 1}. ${formatClusterSummary(cluster)}`);
  }

  if (page.nextCursor) {
    lines.push(`Next page cursor: ${page.nextCursor}`);
  }

  return lines.join("\n");
}

export function formatClusterDetail({ cluster, context, fallbackWorkspace, userId, userName, selectCurrent }) {
  const displayContext = {
    ...context,
    currentWorkspace: context.currentWorkspace ?? fallbackWorkspace
  };
  const lines = [
    ...formatContextLines(displayContext, { userId, userName }),
    "AcornOps cluster:",
    `- Name: ${cluster.name ?? cluster.displayName ?? cluster.clusterName ?? "Unnamed cluster"}`,
    `- ID: ${cluster.id ?? cluster.clusterId ?? "unknown"}`
  ];

  for (const detail of [
    formatField("Status", cluster.status),
    formatField("Agent", cluster.agentState),
    formatField("Version", cluster.kubernetesVersion ?? cluster.version),
    formatField("Provider", cluster.provider),
    formatField("Region", cluster.region)
  ]) {
    if (detail) {
      lines.push(`- ${detail}`);
    }
  }

  const summary = cluster.summary;
  if (summary && typeof summary === "object") {
    lines.push(`- Summary: ${formatCounts(summary)}`);
  }

  if (selectCurrent) {
    lines.push("Current target updated. Use `!chat new`, `!resources`, or `!findings`.");
  } else {
    lines.push("Use `!target 1` or `!cluster 1` to make this the current target.");
  }

  return lines.join("\n");
}

function formatClusterSummary(cluster) {
  const name = cluster.name ?? cluster.displayName ?? cluster.slug ?? cluster.id ?? "Unnamed cluster";
  const id = cluster.id && cluster.id !== name ? ` (${cluster.id})` : "";
  const details = [
    formatField("status", cluster.status),
    formatField("agent", cluster.agentState),
    formatField("version", cluster.kubernetesVersion ?? cluster.version),
    formatField("provider", cluster.provider),
    formatField("region", cluster.region)
  ].filter(Boolean);

  if (details.length === 0) {
    return `${name}${id}`;
  }

  return `${name}${id} - ${details.join(", ")}`;
}

export function formatVirtualMachinePage({ page, context, userId, userName }) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const lines = [
    ...formatContextLines(context, { userId, userName }),
    "AcornOps VMs:"
  ];

  if (items.length === 0) {
    lines.push("- No VMs are available in this workspace.");
    return lines.join("\n");
  }

  for (const [index, vm] of items.entries()) {
    lines.push(`${index + 1}. ${formatVirtualMachineSummary(vm)}`);
  }

  if (page.nextCursor) {
    lines.push(`Next page cursor: ${page.nextCursor}`);
  }

  return lines.join("\n");
}

export function formatVirtualMachineDetail({ vm, context, fallbackWorkspace, userId, userName, selectCurrent }) {
  const displayContext = {
    ...context,
    currentWorkspace: context.currentWorkspace ?? fallbackWorkspace
  };
  const lines = [
    ...formatContextLines(displayContext, { userId, userName }),
    "AcornOps VM:",
    `- Name: ${vm.name ?? vm.displayName ?? vm.hostname ?? "Unnamed VM"}`,
    `- ID: ${vm.id ?? vm.targetId ?? vm.vmId ?? "unknown"}`
  ];

  for (const detail of [
    formatField("Status", vm.status),
    formatField("Hostname", vm.hostname),
    formatField("OS", vm.osFamily),
    formatField("Service manager", vm.serviceManager)
  ]) {
    if (detail) {
      lines.push(`- ${detail}`);
    }
  }

  if (selectCurrent) {
    lines.push("Current target updated. Use `!chat new`, `!resources`, or `!findings`.");
  } else {
    lines.push("Use `!target 1` or `!vm 1` to make this the current target.");
  }

  return lines.join("\n");
}

export function formatResourcePage({ title, page, context, userId, userName }) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const lines = [
    ...formatContextLines(context, { userId, userName }),
    title
  ];

  if (items.length === 0) {
    lines.push("- No resources are available for the selected target.");
    return lines.join("\n");
  }

  for (const [index, resource] of items.entries()) {
    lines.push(`${index + 1}. ${formatResourceSummary(resource)}`);
  }

  if (page.nextCursor) {
    lines.push(`Next page cursor: ${page.nextCursor}`);
  }

  return lines.join("\n");
}

export function formatFindingPage({ title, page, context, userId, userName }) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const lines = [
    ...formatContextLines(context, { userId, userName }),
    title
  ];

  if (items.length === 0) {
    lines.push("- No findings are available.");
    return lines.join("\n");
  }

  for (const [index, finding] of items.entries()) {
    lines.push(`${index + 1}. ${formatFindingSummary(finding)}`);
  }

  if (page.nextCursor) {
    lines.push(`Next page cursor: ${page.nextCursor}`);
  }

  return lines.join("\n");
}

export function formatSessionPage({ page, context, userId, userName }) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const lines = [
    ...formatContextLines(context, { userId, userName }),
    "AcornOps sessions:"
  ];

  if (items.length === 0) {
    lines.push("- No sessions are available for the selected target.");
    return lines.join("\n");
  }

  for (const [index, session] of items.entries()) {
    lines.push(`${index + 1}. ${formatSessionSummary(session)}`);
  }

  if (page.nextCursor) {
    lines.push(`Next page cursor: ${page.nextCursor}`);
  }

  return lines.join("\n");
}

export function formatSessionDetail({ session, context, userId, userName, selectCurrent, created = false }) {
  const lines = [
    ...formatContextLines(context, { userId, userName }),
    created ? "AcornOps session created:" : "AcornOps session:",
    `- Title: ${session.title ?? session.name ?? "Untitled session"}`,
    `- ID: ${session.id ?? session.sessionId ?? "unknown"}`
  ];

  for (const detail of [
    formatField("Status", session.status),
    formatField("Target type", session.targetType),
    formatField("Expires at", session.expiresAt)
  ]) {
    if (detail) {
      lines.push(`- ${detail}`);
    }
  }

  if (selectCurrent) {
    lines.push("Current session updated.");
  }

  return lines.join("\n");
}

export function formatMessagePage({ page, context, userId, userName }) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const lines = [
    ...formatContextLines(context, { userId, userName }),
    "AcornOps session messages:"
  ];

  if (items.length === 0) {
    lines.push("- No messages are available in this session.");
    return lines.join("\n");
  }

  for (const [index, message] of items.entries()) {
    const role = message.role ?? message.kind ?? "message";
    const content = singleLine(message.content ?? "");
    lines.push(`${index + 1}. ${role}: ${content || "(empty)"}`);
  }

  if (page.nextCursor) {
    lines.push(`Next page cursor: ${page.nextCursor}`);
  }

  return lines.join("\n");
}

function formatVirtualMachineSummary(vm) {
  const name = vm.name ?? vm.displayName ?? vm.hostname ?? vm.id ?? vm.targetId ?? "Unnamed VM";
  const id = vm.id ?? vm.targetId ?? vm.vmId;
  const displayId = id && id !== name ? ` (${id})` : "";
  const details = [
    formatField("status", vm.status),
    formatField("hostname", vm.hostname),
    formatField("os", vm.osFamily)
  ].filter(Boolean);

  return details.length > 0 ? `${name}${displayId} - ${details.join(", ")}` : `${name}${displayId}`;
}

function formatResourceSummary(resource) {
  const name = resource.name ?? resource.resourceName ?? resource.itemId ?? resource.id ?? "Unnamed resource";
  const kind = resource.kind ?? resource.resourceKind ?? resource.objectKind;
  const namespace = resource.namespace ?? resource.scopeName;
  const details = [
    kind,
    namespace ? `namespace: ${namespace}` : "",
    formatField("status", resource.status),
    resource.needsAttention === true ? "needs attention" : ""
  ].filter(Boolean);

  return details.length > 0 ? `${name} - ${details.join(", ")}` : name;
}

function formatFindingSummary(finding) {
  const title = finding.title ?? finding.findingId ?? finding.id ?? "Finding";
  const target = [
    finding.clusterName,
    finding.namespace,
    finding.resourceKind ?? finding.objectKind,
    finding.resourceName ?? finding.objectName
  ].filter(Boolean).join("/");
  const details = [
    formatField("severity", finding.severity),
    target
  ].filter(Boolean);

  return details.length > 0 ? `${title} - ${details.join(", ")}` : title;
}

function formatSessionSummary(session) {
  const title = session.title ?? session.name ?? session.id ?? session.sessionId ?? "Untitled session";
  const id = session.id ?? session.sessionId;
  const displayId = id && id !== title ? ` (${id})` : "";
  const details = [
    formatField("status", session.status),
    formatField("target", session.targetType),
    formatField("updated", session.updatedAt)
  ].filter(Boolean);

  return details.length > 0 ? `${title}${displayId} - ${details.join(", ")}` : `${title}${displayId}`;
}

function formatField(label, value) {
  return value ? `${label}: ${value}` : "";
}

function formatQuotaValue(label, quota) {
  if (!quota || typeof quota !== "object") {
    return "";
  }

  const used = quota.used ?? 0;
  const limit = quota.limit ?? "unlimited";
  return `${label} ${used}/${limit}`;
}

export function formatTargetPage({ page, context, userId, userName }) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const lines = [
    ...formatContextLines(context, { userId, userName }),
    "AcornOps targets:"
  ];

  if (items.length === 0) {
    lines.push("- No targets are available in this workspace.");
    return lines.join("\n");
  }

  for (const [index, target] of items.entries()) {
    lines.push(`${index + 1}. ${formatTargetSummary(target)}`);
  }

  if (page.nextCursor) {
    lines.push("More targets are available. Use filters to narrow the list.");
  }

  lines.push("Next: `!target 1`, then `!chat new`.");
  return lines.join("\n");
}

export function formatTargetDetail({ target, context, fallbackWorkspace, userId, userName, selectCurrent }) {
  const displayContext = {
    ...context,
    currentWorkspace: context.currentWorkspace ?? fallbackWorkspace
  };
  const lines = [
    ...formatContextLines(displayContext, { userId, userName }),
    "AcornOps target:",
    `- Name: ${target.name ?? target.displayName ?? target.hostname ?? target.clusterName ?? "Unnamed target"}`,
    `- ID: ${target.id ?? target.targetId ?? target.clusterId ?? target.vmId ?? "unknown"}`
  ];

  for (const detail of [
    formatField("Type", displayTargetType(target.targetType ?? target.type)),
    formatField("Status", target.status),
    formatField("Hostname", target.hostname),
    formatField("Updated", target.updatedAt)
  ]) {
    if (detail) {
      lines.push(`- ${detail}`);
    }
  }

  if (selectCurrent) {
    lines.push("Current target updated. Use `!chat new`, `!resources`, or `!findings`.");
  } else {
    lines.push("Use `!target 1` to make this the current target.");
  }

  return lines.join("\n");
}

function formatTargetSummary(target) {
  const name = target.name ?? target.displayName ?? target.hostname ?? target.clusterName ?? target.id ?? target.targetId ?? "Unnamed target";
  const id = target.id ?? target.targetId ?? target.clusterId ?? target.vmId;
  const displayId = id && id !== name ? ` (${id})` : "";
  const details = [
    displayTargetType(target.targetType ?? target.type),
    formatField("status", target.status)
  ].filter(Boolean);

  return details.length > 0 ? `${name}${displayId} - ${details.join(", ")}` : `${name}${displayId}`;
}

export function formatContextLines(context, { userId, userName } = {}) {
  return [
    `**Current: Workspace: ${formatReferenceName(context?.currentWorkspace)}    |    Target: ${formatReferenceName(selectedContextTarget(context))}**`,
    "————————————————————————————————————————————"
  ];
}

export function formatReference(reference) {
  if (!reference) {
    return "none";
  }

  if (reference.name && reference.id) {
    return `${reference.name} (${reference.id})`;
  }

  return reference.name || reference.id || "unknown";
}

export function formatReferenceName(reference) {
  if (!reference) {
    return "none";
  }

  return reference.name || reference.displayName || reference.title || reference.id || "unknown";
}

export function selectedContextTarget(context) {
  return context?.currentTarget ?? context?.currentCluster ?? context?.currentVm ?? null;
}

export function normalizeListResponse(value) {
  if (Array.isArray(value)) {
    return { items: value };
  }

  if (Array.isArray(value?.items)) {
    return value;
  }

  return { items: [] };
}

export function singleLine(value) {
  const text = String(value);
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}

export function formatChatStatus({ context, userId, userName }) {
  const lines = [
    ...formatContextLines(context, { userId, userName }),
    "Chat runs happen in Mattermost threads."
  ];

  lines.push("Use `!chat new` after choosing a target, then reply in the thread it creates.");

  return lines.join("\n");
}

function displayTargetType(type) {
  const normalized = normalizeTargetType(type);
  if (normalized === "kubernetes") {
    return "Kubernetes";
  }
  if (normalized === "virtual_machine") {
    return "VM";
  }
  return normalized;
}

export function normalizeTargetType(type) {
  if (type === "cluster") {
    return "kubernetes";
  }
  if (type === "vm") {
    return "virtual_machine";
  }
  return type ?? "";
}
