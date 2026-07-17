export function createInMemoryCommandContextStore({ initialState = {} } = {}) {
  const contexts = new Map(Object.entries(initialState.contexts ?? {}));
  const chatThreads = new Map(
    (initialState.chatThreads ?? []).map((thread) => {
      const record = chatThreadReference(thread);
      return [chatThreadKey(record.channelId, record.rootId), record];
    })
  );
  const chatCounters = new Map(
    Object.entries(initialState.chatCounters ?? {}).map(([externalUserId, value]) => [
      externalUserId,
      Number.parseInt(value, 10) || 0
    ])
  );
  const webhookRoutes = new Map(
    (initialState.webhookRoutes ?? []).map((route) => {
      const record = webhookRouteReference(route);
      return [record.externalUserId, record];
    })
  );
  const inboundEvents = new Set(initialState.inboundEvents ?? []);

  return {
    get(externalUserId) {
      return contexts.get(externalUserId) ?? emptyContext();
    },

    rememberWorkspaces(externalUserId, workspaces) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...context,
        workspaces: workspaces.map(workspaceReference)
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    rememberWorkflows(externalUserId, workflows) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...context,
        workflows: workflows.map(workflowReference)
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    selectWorkspace(externalUserId, workspace) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...context,
        currentWorkspace: workspaceReference(workspace),
        workflows: [],
        currentCluster: null,
        currentVm: null,
        targets: [],
        currentTarget: null,
        currentSession: null,
        chatActive: false,
        latestRun: null
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    rememberTargets(externalUserId, targets) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...context,
        targets: targets.map((target) => targetReference({ ...target, source: "target" }))
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    selectTarget(externalUserId, target) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const reference = targetReference({ ...target, source: "target" });
      const nextContext = {
        ...context,
        currentTarget: reference,
        currentCluster: reference.type === "kubernetes" ? clusterReference(target) : null,
        currentVm: reference.type === "virtual_machine" ? vmReference(target) : null,
        currentSession: null,
        chatActive: false,
        latestRun: null
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    rememberClusters(externalUserId, clusters) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...context,
        clusters: clusters.map(clusterReference)
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    selectCluster(externalUserId, cluster) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const target = targetReference({ ...cluster, targetType: "kubernetes", source: "cluster" });
      const nextContext = {
        ...context,
        currentCluster: clusterReference(cluster),
        currentVm: null,
        currentTarget: target,
        currentSession: null,
        chatActive: false,
        latestRun: null
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    rememberVirtualMachines(externalUserId, vms) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...context,
        virtualMachines: vms.map(vmReference)
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    selectVirtualMachine(externalUserId, vm) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const target = targetReference({ ...vm, targetType: "virtual_machine", source: "vm" });
      const nextContext = {
        ...context,
        currentVm: vmReference(vm),
        currentCluster: null,
        currentTarget: target,
        currentSession: null,
        chatActive: false,
        latestRun: null
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    rememberSessions(externalUserId, sessions) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...context,
        sessions: sessions.map(sessionReference)
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    selectSession(externalUserId, session) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...context,
        currentSession: sessionReference(session)
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    startChat(externalUserId, session) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...context,
        currentSession: sessionReference(session),
        chatActive: true,
        latestRun: null
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    pauseChat(externalUserId) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...context,
        chatActive: false
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    resumeChat(externalUserId) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...context,
        chatActive: Boolean(context.currentSession)
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    endChat(externalUserId) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...context,
        currentSession: null,
        chatActive: false,
        latestRun: null,
        activeRun: null
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    rememberLatestRun(externalUserId, run) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...context,
        latestRun: runReference(run)
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    rememberActiveRun(externalUserId, run) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...context,
        activeRun: runReference(run)
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    clearActiveRun(externalUserId, runId = "") {
      const context = contexts.get(externalUserId) ?? emptyContext();
      if (runId && context.activeRun?.id && context.activeRun.id !== runId) {
        return context;
      }

      const nextContext = {
        ...context,
        activeRun: null
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    rememberAccountFingerprint(externalUserId, accountFingerprint) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...context,
        accountFingerprint: accountFingerprint ?? "",
        loginValidationPending: false
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    markLoginValidationPending(externalUserId) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...context,
        loginValidationPending: true
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    clearLoginValidationPending(externalUserId) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...context,
        loginValidationPending: false
      };
      contexts.set(externalUserId, nextContext);
      return nextContext;
    },

    resetAccountContext(externalUserId, { clearAccountFingerprint = false } = {}) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...emptyContext(),
        accountFingerprint: clearAccountFingerprint ? "" : context.accountFingerprint,
        loginValidationPending: context.loginValidationPending,
        contextGeneration: (context.contextGeneration ?? 0) + 1
      };
      contexts.set(externalUserId, nextContext);
      for (const [key, thread] of chatThreads.entries()) {
        if (thread.externalUserId === externalUserId) {
          chatThreads.delete(key);
        }
      }
      return nextContext;
    },

    nextChatNumber(externalUserId) {
      const next = (chatCounters.get(externalUserId) ?? 0) + 1;
      chatCounters.set(externalUserId, next);
      return next;
    },

    registerChatThread(externalUserId, thread) {
      const record = chatThreadReference({
        ...thread,
        externalUserId,
        status: thread.status ?? "open"
      });
      chatThreads.set(chatThreadKey(record.channelId, record.rootId), record);
      return record;
    },

    getChatThread(channelId, rootId) {
      return chatThreads.get(chatThreadKey(channelId, rootId)) ?? null;
    },

    closeChatThread(channelId, rootId, externalUserId = "") {
      const key = chatThreadKey(channelId, rootId);
      const record = chatThreads.get(key);
      if (!record || (externalUserId && record.externalUserId !== externalUserId)) {
        return null;
      }
      const nextRecord = {
        ...record,
        status: "closed",
        activeRun: null
      };
      chatThreads.set(key, nextRecord);
      return nextRecord;
    },

    rememberActiveRunForChat(channelId, rootId, run) {
      const key = chatThreadKey(channelId, rootId);
      const record = chatThreads.get(key);
      if (!record) {
        return null;
      }
      const nextRecord = {
        ...record,
        activeRun: runReference(run)
      };
      chatThreads.set(key, nextRecord);
      return nextRecord;
    },

    clearActiveRunForChat(channelId, rootId, runId = "") {
      const key = chatThreadKey(channelId, rootId);
      const record = chatThreads.get(key);
      if (!record) {
        return null;
      }
      if (runId && record.activeRun?.id && record.activeRun.id !== runId) {
        return record;
      }
      const nextRecord = {
        ...record,
        activeRun: null
      };
      chatThreads.set(key, nextRecord);
      return nextRecord;
    },

    upsertWebhookRoute(externalUserId, route) {
      const record = webhookRouteReference({
        ...route,
        externalUserId
      });
      webhookRoutes.set(externalUserId, record);
      return record;
    },

    getWebhookRoute(externalUserId) {
      return webhookRoutes.get(externalUserId) ?? null;
    },

    getWebhookRouteByTokenHash(routeTokenHash) {
      for (const route of webhookRoutes.values()) {
        if (route.routeTokenHash && route.routeTokenHash === routeTokenHash) {
          return route;
        }
      }
      return null;
    },

    deleteWebhookRoute(externalUserId) {
      const record = webhookRoutes.get(externalUserId) ?? null;
      webhookRoutes.delete(externalUserId);
      return record;
    },

    connectWebhookRoute(externalUserId, route) {
      const current = webhookRoutes.get(externalUserId) ?? {};
      const record = webhookRouteReference({
        ...current,
        ...route,
        externalUserId,
        connectionStatus: "connected",
        connectedAt: route.connectedAt ?? new Date().toISOString()
      });
      webhookRoutes.set(externalUserId, record);
      return record;
    },

    rememberInboundEvent(eventId) {
      if (!eventId) {
        return false;
      }
      if (inboundEvents.has(eventId)) {
        return false;
      }
      inboundEvents.add(eventId);
      return true;
    }
  };
}

export function createNullCommandContextStore() {
  return {
    get() {
      return emptyContext();
    },
    rememberWorkspaces(_externalUserId, workspaces) {
      return {
        ...emptyContext(),
        workspaces: workspaces.map(workspaceReference)
      };
    },
    rememberWorkflows(_externalUserId, workflows) {
      return {
        ...emptyContext(),
        workflows: workflows.map(workflowReference)
      };
    },
    selectWorkspace(_externalUserId, workspace) {
      return {
        ...emptyContext(),
        currentWorkspace: workspaceReference(workspace)
      };
    },
    rememberTargets(_externalUserId, targets) {
      return {
        ...emptyContext(),
        targets: targets.map((target) => targetReference({ ...target, source: "target" }))
      };
    },
    selectTarget(_externalUserId, target) {
      const reference = targetReference({ ...target, source: "target" });
      return {
        ...emptyContext(),
        currentTarget: reference,
        currentCluster: reference.type === "kubernetes" ? clusterReference(target) : null,
        currentVm: reference.type === "virtual_machine" ? vmReference(target) : null
      };
    },
    rememberClusters(_externalUserId, clusters) {
      return {
        ...emptyContext(),
        clusters: clusters.map(clusterReference)
      };
    },
    selectCluster(_externalUserId, cluster) {
      const target = targetReference({ ...cluster, targetType: "kubernetes", source: "cluster" });
      return {
        ...emptyContext(),
        currentCluster: clusterReference(cluster),
        currentTarget: target
      };
    },
    rememberVirtualMachines(_externalUserId, vms) {
      return {
        ...emptyContext(),
        virtualMachines: vms.map(vmReference)
      };
    },
    selectVirtualMachine(_externalUserId, vm) {
      const target = targetReference({ ...vm, targetType: "virtual_machine", source: "vm" });
      return {
        ...emptyContext(),
        currentVm: vmReference(vm),
        currentTarget: target
      };
    },
    rememberSessions(_externalUserId, sessions) {
      return {
        ...emptyContext(),
        sessions: sessions.map(sessionReference)
      };
    },
    selectSession(_externalUserId, session) {
      return {
        ...emptyContext(),
        currentSession: sessionReference(session)
      };
    },
    startChat(_externalUserId, session) {
      return {
        ...emptyContext(),
        currentSession: sessionReference(session),
        chatActive: true
      };
    },
    pauseChat() {
      return emptyContext();
    },
    resumeChat() {
      return emptyContext();
    },
    endChat() {
      return emptyContext();
    },
    rememberLatestRun(_externalUserId, run) {
      return {
        ...emptyContext(),
        latestRun: runReference(run)
      };
    },
    rememberActiveRun(_externalUserId, run) {
      return {
        ...emptyContext(),
        activeRun: runReference(run)
      };
    },
    clearActiveRun() {
      return emptyContext();
    },
    rememberAccountFingerprint(_externalUserId, accountFingerprint) {
      return {
        ...emptyContext(),
        accountFingerprint: accountFingerprint ?? ""
      };
    },
    markLoginValidationPending() {
      return {
        ...emptyContext(),
        loginValidationPending: true
      };
    },
    clearLoginValidationPending() {
      return emptyContext();
    },
    resetAccountContext(_externalUserId, { clearAccountFingerprint = false } = {}) {
      return {
        ...emptyContext(),
        accountFingerprint: clearAccountFingerprint ? "" : emptyContext().accountFingerprint,
        contextGeneration: 1
      };
    },
    nextChatNumber() {
      return 1;
    },
    registerChatThread(_externalUserId, thread) {
      return chatThreadReference(thread);
    },
    getChatThread() {
      return null;
    },
    closeChatThread() {
      return null;
    },
    rememberActiveRunForChat() {
      return null;
    },
    clearActiveRunForChat() {
      return null;
    },
    upsertWebhookRoute(_externalUserId, route) {
      return webhookRouteReference(route);
    },
    connectWebhookRoute(_externalUserId, route) {
      return webhookRouteReference({
        ...route,
        connectionStatus: "connected"
      });
    },
    getWebhookRoute() {
      return null;
    },
    getWebhookRouteByTokenHash() {
      return null;
    },
    deleteWebhookRoute() {
      return null;
    },
    rememberInboundEvent() {
      return true;
    }
  };
}

export function chatThreadKey(channelId, rootId) {
  return `${channelId ?? ""}:${rootId ?? ""}`;
}

export function resolveWorkspaceReference(reference, context) {
  if (!reference) {
    return context.currentWorkspace ?? null;
  }

  const workspaceIndex = Number.parseInt(reference, 10);
  if (String(workspaceIndex) === reference && workspaceIndex > 0) {
    return context.workspaces[workspaceIndex - 1] ?? null;
  }

  return workspaceReference({ id: reference, name: "" });
}

export function resolveWorkflowReference(reference, context) {
  return resolveReference(reference, null, context.workflows, workflowReference);
}

export function resolveClusterReference(reference, context) {
  return resolveReference(reference, context.currentCluster, context.clusters, clusterReference);
}

export function resolveTargetReference(reference, context) {
  return resolveReference(reference, context.currentTarget, context.targets, targetReference);
}

export function resolveVirtualMachineReference(reference, context) {
  return resolveReference(reference, context.currentVm, context.virtualMachines, vmReference);
}

export function resolveSessionReference(reference, context) {
  return resolveReference(reference, context.currentSession, context.sessions, sessionReference);
}

function emptyContext() {
  return {
    workspaces: [],
    workflows: [],
    currentWorkspace: null,
    clusters: [],
    currentCluster: null,
    targets: [],
    currentTarget: null,
    virtualMachines: [],
    currentVm: null,
    sessions: [],
    currentSession: null,
    chatActive: false,
    latestRun: null,
    activeRun: null,
    accountFingerprint: "",
    loginValidationPending: false,
    contextGeneration: 0
  };
}

function workspaceReference(workspace) {
  return {
    id: workspace.id ?? "",
    name: workspace.name ?? workspace.displayName ?? workspace.slug ?? ""
  };
}

function workflowReference(workflow) {
  return {
    id: workflow.id ?? workflow.workflowId ?? "",
    name: workflow.name ?? workflow.title ?? ""
  };
}

function clusterReference(cluster) {
  return {
    id: cluster.id ?? cluster.clusterId ?? "",
    name: cluster.name ?? cluster.displayName ?? cluster.slug ?? cluster.clusterName ?? ""
  };
}

function vmReference(vm) {
  return {
    id: vm.id ?? vm.targetId ?? vm.vmId ?? "",
    name: vm.name ?? vm.displayName ?? vm.hostname ?? ""
  };
}

function targetReference(target) {
  const type = normalizeTargetType(target.targetType ?? target.type);
  return {
    id: target.id ?? target.targetId ?? target.clusterId ?? target.vmId ?? "",
    name: target.name ?? target.displayName ?? target.hostname ?? target.clusterName ?? "",
    type,
    source: target.source ?? "target"
  };
}

function sessionReference(session) {
  return {
    id: session.id ?? session.sessionId ?? "",
    name: session.title ?? session.name ?? ""
  };
}

function runReference(run) {
  const reference = {
    id: run.id ?? run.runId ?? run.run_id ?? "",
    status: run.status ?? "",
    sessionId: run.sessionId ?? run.session_id ?? ""
  };
  const executionId = run.executionId ?? run.execution_id ?? "";
  if (run.kind === "workflow" || executionId) {
    reference.kind = "workflow";
    reference.executionId = executionId;
    reference.lastEventId = run.lastEventId ?? run.last_event_id ?? "";
  }
  return reference;
}

function chatThreadReference(thread) {
  return {
    externalUserId: thread.externalUserId ?? "",
    channelId: thread.channelId ?? thread.channel_id ?? "",
    rootId: thread.rootId ?? thread.root_id ?? "",
    sessionId: thread.sessionId ?? thread.session_id ?? "",
    sessionName: thread.sessionName ?? thread.session_name ?? thread.title ?? thread.name ?? "",
    title: thread.title ?? thread.sessionName ?? thread.session_name ?? thread.name ?? "",
    number: Number.isInteger(thread.number) ? thread.number : Number.parseInt(thread.number ?? "0", 10) || 0,
    status: thread.status ?? "open",
    kind: thread.kind ?? thread.threadKind ?? thread.thread_kind ?? "chat",
    workflowId: thread.workflowId ?? thread.workflow_id ?? "",
    workspaceId: thread.workspaceId ?? thread.workspace_id ?? "",
    toolAccessMode: thread.toolAccessMode ?? thread.tool_access_mode ?? "read_only",
    workflowInputs: normalizeWorkflowInputs(
      thread.workflowInputs ?? thread.workflow_inputs ?? {}
    ),
    activeRun: thread.activeRun ? runReference(thread.activeRun) : null
  };
}

function normalizeWorkflowInputs(inputs) {
  return inputs && typeof inputs === "object" && !Array.isArray(inputs)
    ? { ...inputs }
    : {};
}

function webhookRouteReference(route) {
  return {
    provider: route.provider ?? "acornops",
    externalUserId: route.externalUserId ?? "",
    channelId: route.channelId ?? route.channel_id ?? "",
    rootId: route.rootId ?? route.root_id ?? "",
    displayName: route.displayName ?? route.display_name ?? "",
    routeTokenHash: route.routeTokenHash ?? route.route_token_hash ?? "",
    signingSecret: route.signingSecret ?? route.signing_secret ?? "",
    deliveryUrl: route.deliveryUrl ?? route.delivery_url ?? "",
    connectionStatus: route.connectionStatus ?? route.connection_status ?? (route.signingSecret || route.signing_secret ? "connected" : "pending"),
    connectedAt: route.connectedAt ?? route.connected_at ?? "",
    lastSyncedAt: route.lastSyncedAt ?? route.last_synced_at ?? "",
    lastError: route.lastError ?? route.last_error ?? "",
    subscriptions: normalizeWebhookSubscriptions(route.subscriptions ?? route.subscription_snapshot ?? [])
  };
}

function normalizeWebhookSubscriptions(subscriptions) {
  if (!Array.isArray(subscriptions)) {
    return [];
  }
  return subscriptions.map((subscription) => ({
    workspaceId: subscription.workspaceId ?? subscription.workspace_id ?? "",
    workspaceName: subscription.workspaceName ?? subscription.workspace_name ?? "",
    webhookId: subscription.webhookId ?? subscription.webhook_id ?? subscription.id ?? "",
    eventTypes: Array.isArray(subscription.eventTypes ?? subscription.event_types)
      ? (subscription.eventTypes ?? subscription.event_types).map(String)
      : [],
    signingSecret: subscription.signingSecret ?? subscription.signing_secret ?? "",
    enabled: subscription.enabled !== false,
    status: subscription.status ?? (subscription.enabled === false ? "disabled" : "enabled"),
    updatedAt: subscription.updatedAt ?? subscription.updated_at ?? "",
    lastSyncedAt: subscription.lastSyncedAt ?? subscription.last_synced_at ?? ""
  }));
}

function resolveReference(reference, current, remembered, referenceFactory) {
  if (!reference) {
    return current ?? null;
  }

  const index = Number.parseInt(reference, 10);
  if (String(index) === reference && index > 0) {
    return remembered[index - 1] ?? null;
  }

  return referenceFactory({ id: reference, name: "" });
}

function normalizeTargetType(type) {
  if (type === "vm") {
    return "virtual_machine";
  }

  if (type === "cluster") {
    return "kubernetes";
  }

  return type ?? "";
}
