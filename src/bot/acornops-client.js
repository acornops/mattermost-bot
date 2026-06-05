export class AcornOpsClient {
  constructor({ baseUrl, chatServiceToken = "", fetchImpl = globalThis.fetch }) {
    this.baseUrl = baseUrl?.replace(/\/$/, "");
    this.chatServiceToken = chatServiceToken;
    this.fetchImpl = fetchImpl;

    if (!this.baseUrl) {
      throw new Error("CSIT_ACORNOPS_URL is required.");
    }

    if (typeof this.fetchImpl !== "function") {
      throw new Error("A fetch implementation is required.");
    }
  }

  oidcLoginUrl({ returnTo } = {}) {
    const url = new URL(`${this.baseUrl}/api/v1/auth/oidc/login`);
    if (returnTo) {
      url.searchParams.set("return_to", returnTo);
    }

    return url.toString();
  }

  canStartMattermostChatLogin() {
    return Boolean(this.chatServiceToken);
  }

  async startMattermostChatLogin({ mattermostUserId, mattermostUserName = "", returnTo = "" }) {
    if (!this.canStartMattermostChatLogin()) {
      throw new Error("CSIT_ACORNOPS_CHAT_SERVICE_TOKEN is required for backend chat login.");
    }

    return this.requestJson("POST", "/api/v1/auth/chat/mattermost/login", {
      mattermostUserId,
      mattermostUserName,
      returnTo
    }, {
      serviceAuth: true
    });
  }

  async getMattermostChatLogin(loginId) {
    if (!this.canStartMattermostChatLogin()) {
      throw new Error("CSIT_ACORNOPS_CHAT_SERVICE_TOKEN is required for backend chat login.");
    }

    return this.requestJson("GET", `/api/v1/auth/chat/mattermost/login/${encodeURIComponent(loginId)}`, undefined, {
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
