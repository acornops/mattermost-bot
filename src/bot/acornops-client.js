import { JsonHttpClient } from "./http-client.js";

export class AcornOpsClient {
  constructor({
    baseUrl,
    externalIntegrationToken = "",
    fetchImpl = globalThis.fetch
  }) {
    this.http = new JsonHttpClient({
      baseUrl,
      fetchImpl,
      serviceName: "AcornOps",
      missingBaseUrlMessage: "ACORNOPS_API_BASE_URL is required."
    });
    this.externalIntegrationToken = externalIntegrationToken;
  }

  canUseExternalIntegrationAuth() {
    return Boolean(this.externalIntegrationToken);
  }

  async createExternalIntegrationLink(identity) {
    this.requireExternalIntegrationAuth();

    return this.requestJson("POST", "/api/v1/auth/external-integrations/link", identity, {
      serviceAuth: true
    });
  }

  async resolveExternalIntegrationLink(identity) {
    this.requireExternalIntegrationAuth();

    return this.requestJson("POST", "/api/v1/auth/external-integrations/resolve", identity, {
      serviceAuth: true
    });
  }

  async listWorkspaces(identity, { limit = 50, cursor = "", q = "" } = {}) {
    this.requireExternalIntegrationAuth();

    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (cursor) {
      params.set("cursor", cursor);
    }
    if (q) {
      params.set("q", q);
    }

    return this.requestJson(
      "GET",
      `/api/v1/workspaces?${params.toString()}`,
      undefined,
      {
        serviceAuth: true,
        headers: this.externalUserHeaders(identity)
      }
    );
  }

  async getWorkspace(identity, workspaceId) {
    this.requireExternalIntegrationAuth();

    return this.requestJson(
      "GET",
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}`,
      undefined,
      {
        serviceAuth: true,
        headers: this.externalUserHeaders(identity)
      }
    );
  }

  async listWorkspaceInvestigations(
    identity,
    workspaceId,
    { limit = 50, cursor = "", q = "", severity = "", clusterId = "", namespace = "" } = {}
  ) {
    return this.getExternalPage(
      identity,
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/investigations`,
      { limit, cursor, q, severity, clusterId, namespace }
    );
  }

  async listKubernetesClusters(
    identity,
    workspaceId,
    { limit = 50, cursor = "", q = "", status = "", agentState = "" } = {}
  ) {
    this.requireExternalIntegrationAuth();

    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (cursor) {
      params.set("cursor", cursor);
    }
    if (q) {
      params.set("q", q);
    }
    if (status) {
      params.set("status", status);
    }
    if (agentState) {
      params.set("agentState", agentState);
    }

    return this.requestJson(
      "GET",
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/kubernetes-clusters?${params.toString()}`,
      undefined,
      {
        serviceAuth: true,
        headers: this.externalUserHeaders(identity)
      }
    );
  }

  async getKubernetesCluster(identity, workspaceId, clusterId) {
    return this.getExternalResource(
      identity,
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/kubernetes-clusters/${encodeURIComponent(clusterId)}`
    );
  }

  async listKubernetesClusterResources(
    identity,
    workspaceId,
    clusterId,
    { limit = 100, cursor = "", q = "", family = "", kind = "", namespace = "", health = "" } = {}
  ) {
    return this.getExternalPage(
      identity,
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/kubernetes-clusters/${encodeURIComponent(clusterId)}/resources`,
      { limit, cursor, q, family, kind, namespace, health }
    );
  }

  async listKubernetesClusterFindings(
    identity,
    workspaceId,
    clusterId,
    { limit = 50, cursor = "", q = "", severity = "", namespace = "" } = {}
  ) {
    return this.getExternalPage(
      identity,
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/kubernetes-clusters/${encodeURIComponent(clusterId)}/findings`,
      { limit, cursor, q, severity, namespace }
    );
  }

  async listVirtualMachines(
    identity,
    workspaceId,
    { limit = 50, cursor = "", q = "", status = "" } = {}
  ) {
    return this.getExternalPage(
      identity,
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/virtual-machines`,
      { limit, cursor, q, status }
    );
  }

  async getVirtualMachine(identity, workspaceId, vmId) {
    return this.getExternalResource(
      identity,
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/virtual-machines/${encodeURIComponent(vmId)}`
    );
  }

  async listVirtualMachineResources(identity, workspaceId, vmId) {
    return this.getExternalResource(
      identity,
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/virtual-machines/${encodeURIComponent(vmId)}/resources`
    );
  }

  async listVirtualMachineFindings(identity, workspaceId, vmId) {
    return this.getExternalResource(
      identity,
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/virtual-machines/${encodeURIComponent(vmId)}/findings`
    );
  }

  async listKubernetesClusterSessions(
    identity,
    workspaceId,
    clusterId,
    { limit = 20, cursor = "", q = "", status = "" } = {}
  ) {
    return this.getExternalPage(
      identity,
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/kubernetes-clusters/${encodeURIComponent(clusterId)}/sessions`,
      { limit, cursor, q, status }
    );
  }

  async listTargetSessions(
    identity,
    workspaceId,
    targetId,
    { limit = 20, cursor = "", q = "", status = "" } = {}
  ) {
    return this.getExternalPage(
      identity,
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/targets/${encodeURIComponent(targetId)}/sessions`,
      { limit, cursor, q, status }
    );
  }

  async createKubernetesClusterSession(identity, workspaceId, clusterId, { title }) {
    return this.postExternalResource(
      identity,
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/kubernetes-clusters/${encodeURIComponent(clusterId)}/sessions`,
      { title }
    );
  }

  async createTargetSession(identity, workspaceId, targetId, { title }) {
    return this.postExternalResource(
      identity,
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/targets/${encodeURIComponent(targetId)}/sessions`,
      { title }
    );
  }

  async getSession(identity, sessionId) {
    return this.getExternalResource(identity, `/api/v1/sessions/${encodeURIComponent(sessionId)}`);
  }

  async listSessionMessages(identity, sessionId, { limit = 100, cursor = "" } = {}) {
    return this.getExternalPage(
      identity,
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/messages`,
      { limit, cursor }
    );
  }

  async postSessionMessage(identity, sessionId, { content, clientMessageId }) {
    return this.postExternalResource(
      identity,
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/messages`,
      {
        content,
        toolAccessMode: "read_only",
        clientMessageId
      }
    );
  }

  async getRun(identity, runId) {
    return this.getExternalResource(identity, `/api/v1/runs/${encodeURIComponent(runId)}`);
  }

  async getExternalPage(identity, path, query = {}) {
    this.requireExternalIntegrationAuth();

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== "" && value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }

    const queryString = params.toString();
    return this.requestJson(
      "GET",
      queryString ? `${path}?${queryString}` : path,
      undefined,
      {
        serviceAuth: true,
        headers: this.externalUserHeaders(identity)
      }
    );
  }

  async getExternalResource(identity, path) {
    this.requireExternalIntegrationAuth();

    return this.requestJson("GET", path, undefined, {
      serviceAuth: true,
      headers: this.externalUserHeaders(identity)
    });
  }

  async postExternalResource(identity, path, body) {
    this.requireExternalIntegrationAuth();

    return this.requestJson("POST", path, body, {
      serviceAuth: true,
      headers: this.externalUserHeaders(identity)
    });
  }

  async requestJson(method, path, body, options = {}) {
    return await this.http.requestJson(method, path, body, {
      ...options,
      headers: this.headersFor(options)
    });
  }

  async request(method, path, body, options = {}) {
    return await this.http.request(method, path, body, {
      ...options,
      headers: this.headersFor(options)
    });
  }

  headersFor(options = {}) {
    const headers = {
      ...options.headers
    };

    if (!options.serviceAuth) {
      return headers;
    }

    return {
      ...headers,
      authorization: `Bearer ${this.externalIntegrationToken}`
    };
  }

  requireExternalIntegrationAuth() {
    if (!this.canUseExternalIntegrationAuth()) {
      throw new Error("EXTERNAL_INTEGRATION_SERVICE_TOKEN is required for external integration auth.");
    }
  }

  externalUserHeaders(identity) {
    return {
      "x-acornops-external-user-id": identity.externalUserId
    };
  }
}
