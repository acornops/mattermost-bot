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

  async connectWebhookRoute(identity, { deliveryUrl }) {
    this.requireExternalIntegrationAuth();

    return this.requestJson(
      "POST",
      "/api/v1/external-integrations/webhook-routes/connect",
      { deliveryUrl },
      {
        serviceAuth: true,
        headers: this.externalUserHeaders(identity)
      }
    );
  }

  async getWebhookRouteStatus(identity, { deliveryUrl }) {
    this.requireExternalIntegrationAuth();

    const params = new URLSearchParams();
    params.set("deliveryUrl", deliveryUrl);

    return this.requestJson(
      "GET",
      `/api/v1/external-integrations/webhook-routes/status?${params.toString()}`,
      undefined,
      {
        serviceAuth: true,
        headers: this.externalUserHeaders(identity)
      }
    );
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

  async listTargets(
    identity,
    workspaceId,
    { limit = 50, cursor = "", q = "", targetType = "" } = {}
  ) {
    return this.getExternalPage(
      identity,
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/targets`,
      { limit, cursor, q, targetType }
    );
  }

  async getTarget(identity, workspaceId, targetId) {
    return this.getExternalResource(
      identity,
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/targets/${encodeURIComponent(targetId)}`
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

  async listWorkflows(identity, workspaceId) {
    return this.getExternalResource(
      identity,
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/workflows`
    );
  }

  async createWorkflowSession(identity, workflowId, { workspaceId, approvedContextGrants }) {
    return this.postExternalResource(
      identity,
      `/api/v1/workflows/${encodeURIComponent(workflowId)}/sessions`,
      { workspaceId, approvedContextGrants }
    );
  }

  async postWorkflowSessionMessage(identity, sessionId, { workspaceId, content, inputs = {} }) {
    return this.postExternalResource(
      identity,
      `/api/v1/workflow-sessions/${encodeURIComponent(sessionId)}/messages`,
      { workspaceId, content, inputs }
    );
  }

  async getRun(identity, runId) {
    return this.getExternalResource(identity, `/api/v1/runs/${encodeURIComponent(runId)}`);
  }

  async streamRun(identity, runId, { signal } = {}) {
    this.requireExternalIntegrationAuth();

    const response = await this.request(
      "GET",
      `/api/v1/runs/${encodeURIComponent(runId)}/stream`,
      undefined,
      {
        serviceAuth: true,
        signal,
        headers: {
          ...this.externalUserHeaders(identity),
          accept: "text/event-stream"
        }
      }
    );

    return parseServerSentEvents(response.body);
  }

  async listRunEvents(identity, runId) {
    return this.getExternalResource(identity, `/api/v1/runs/${encodeURIComponent(runId)}/events`);
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

export async function* parseServerSentEvents(body) {
  if (!body) {
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of body) {
    buffer += decodeSseChunk(chunk, decoder, true);
    let boundary = eventBoundary(buffer);
    while (boundary) {
      const frame = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary.length);
      const event = parseSseFrame(frame);
      if (event) {
        yield event;
      }
      boundary = eventBoundary(buffer);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const event = parseSseFrame(buffer);
    if (event) {
      yield event;
    }
  }
}

function decodeSseChunk(chunk, decoder, stream) {
  if (typeof chunk === "string") {
    return chunk;
  }

  return decoder.decode(chunk, { stream });
}

function eventBoundary(value) {
  const lf = value.indexOf("\n\n");
  const crlf = value.indexOf("\r\n\r\n");
  if (lf === -1 && crlf === -1) {
    return null;
  }

  if (lf === -1 || (crlf !== -1 && crlf < lf)) {
    return { index: crlf, length: 4 };
  }

  return { index: lf, length: 2 };
}

function parseSseFrame(frame) {
  let event = "message";
  const dataLines = [];
  let hasField = false;

  for (const rawLine of frame.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith(":")) {
      continue;
    }

    hasField = true;
    const separatorIndex = rawLine.indexOf(":");
    const field = separatorIndex === -1 ? rawLine : rawLine.slice(0, separatorIndex);
    const value = separatorIndex === -1
      ? ""
      : rawLine.slice(separatorIndex + 1).replace(/^ /, "");

    if (field === "event") {
      event = value || "message";
    } else if (field === "data") {
      dataLines.push(value);
    }
  }

  if (!hasField) {
    return null;
  }

  const dataText = dataLines.join("\n");
  return {
    event,
    data: parseSseData(dataText)
  };
}

function parseSseData(dataText) {
  if (!dataText) {
    return null;
  }

  try {
    return JSON.parse(dataText);
  } catch {
    return dataText;
  }
}
