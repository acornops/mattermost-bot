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
        currentSession: null
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
      const nextContext = {
        ...context,
        currentCluster: clusterReference(cluster),
        currentVm: null,
        currentSession: null
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
      const nextContext = {
        ...context,
        currentVm: vmReference(vm),
        currentCluster: null,
        currentSession: null
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
    rememberClusters(_externalUserId, clusters) {
      return {
        ...emptyContext(),
        clusters: clusters.map(clusterReference)
      };
    },
    selectCluster(_externalUserId, cluster) {
      return {
        ...emptyContext(),
        currentCluster: clusterReference(cluster)
      };
    },
    rememberVirtualMachines(_externalUserId, vms) {
      return {
        ...emptyContext(),
        virtualMachines: vms.map(vmReference)
      };
    },
    selectVirtualMachine(_externalUserId, vm) {
      return {
        ...emptyContext(),
        currentVm: vmReference(vm)
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
    virtualMachines: [],
    currentVm: null,
    sessions: [],
    currentSession: null
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

function sessionReference(session) {
  return {
    id: session.id ?? session.sessionId ?? "",
    name: session.title ?? session.name ?? ""
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
