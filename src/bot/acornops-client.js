import { JsonHttpClient } from "./http-client.js";

export class AcornOpsClient {
  constructor({ baseUrl, chatServiceToken = "", fetchImpl = globalThis.fetch }) {
    this.http = new JsonHttpClient({
      baseUrl,
      fetchImpl,
      serviceName: "AcornOps",
      missingBaseUrlMessage: "ACORNOPS_API_BASE_URL is required."
    });
    this.chatServiceToken = chatServiceToken;
  }

  canUseMattermostChatAuth() {
    return Boolean(this.chatServiceToken);
  }

  async createMattermostLink(identity) {
    if (!this.canUseMattermostChatAuth()) {
      throw new Error("MATTERMOST_CHAT_SERVICE_TOKEN is required for Mattermost chat auth.");
    }

    return this.requestJson("POST", "/api/v1/auth/chat/integration/link", identity, {
      serviceAuth: true
    });
  }

  async resolveMattermostLink(identity) {
    if (!this.canUseMattermostChatAuth()) {
      throw new Error("MATTERMOST_CHAT_SERVICE_TOKEN is required for Mattermost chat auth.");
    }

    return this.requestJson("POST", "/api/v1/auth/chat/integration/resolve", identity, {
      serviceAuth: true
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
      authorization: `Bearer ${this.chatServiceToken}`
    };
  }
}
