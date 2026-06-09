export class AcornOpsClient {
  constructor({ baseUrl, chatServiceToken = "", fetchImpl = globalThis.fetch }) {
    this.baseUrl = baseUrl?.replace(/\/$/, "");
    this.chatServiceToken = chatServiceToken;
    this.fetchImpl = fetchImpl;

    if (!this.baseUrl) {
      throw new Error("ACORNOPS_API_BASE_URL is required.");
    }

    if (typeof this.fetchImpl !== "function") {
      throw new Error("A fetch implementation is required.");
    }
  }

  canUseMattermostChatAuth() {
    return Boolean(this.chatServiceToken);
  }

  async createMattermostLink(identity) {
    if (!this.canUseMattermostChatAuth()) {
      throw new Error("MATTERMOST_CHAT_SERVICE_TOKEN is required for Mattermost chat auth.");
    }

    return this.requestJson("POST", "/api/v1/auth/chat/mattermost/link", identity, {
      serviceAuth: true
    });
  }

  async resolveMattermostLink(identity) {
    if (!this.canUseMattermostChatAuth()) {
      throw new Error("MATTERMOST_CHAT_SERVICE_TOKEN is required for Mattermost chat auth.");
    }

    return this.requestJson("POST", "/api/v1/auth/chat/mattermost/resolve", identity, {
      serviceAuth: true
    });
  }

  async requestJson(method, path, body, options = {}) {
    const response = await this.request(method, path, body, options);
    return await response.json();
  }

  async request(method, path, body, options = {}) {
    const headers = {
      "content-type": "application/json"
    };

    if (options.serviceAuth) {
      headers.authorization = `Bearer ${this.chatServiceToken}`;
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AcornOps API ${method} ${path} failed with ${response.status}: ${text}`);
    }

    return response;
  }
}
