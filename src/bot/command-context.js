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
        currentWorkspace: workspaceReference(workspace)
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

function emptyContext() {
  return {
    workspaces: [],
    currentWorkspace: null
  };
}

function workspaceReference(workspace) {
  return {
    id: workspace.id ?? "",
    name: workspace.name ?? workspace.displayName ?? workspace.slug ?? ""
  };
}
