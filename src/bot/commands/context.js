export function createInMemoryCommandContextStore() {
  const contexts = new Map();

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

    selectWorkspace(externalUserId, workspace) {
      const context = contexts.get(externalUserId) ?? emptyContext();
      const nextContext = {
        ...context,
        currentWorkspace: workspaceReference(workspace),
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
    }
  };
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
    activeRun: null
  };
}

function workspaceReference(workspace) {
  return {
    id: workspace.id ?? "",
    name: workspace.name ?? workspace.displayName ?? workspace.slug ?? ""
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
  return {
    id: run.id ?? run.runId ?? run.run_id ?? "",
    status: run.status ?? "",
    sessionId: run.sessionId ?? run.session_id ?? ""
  };
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
