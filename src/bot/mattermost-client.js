export class MattermostClient {
  constructor({ baseUrl, token, fetchImpl = globalThis.fetch }) {
    this.baseUrl = baseUrl?.replace(/\/$/, "");
    this.token = token;
    this.fetchImpl = fetchImpl;

    if (!this.baseUrl) {
      throw new Error("CSIT_MATTERMOST_URL is required.");
    }

    if (!this.token) {
      throw new Error("CSIT_MATTERMOST_TOKEN is required.");
    }

    if (typeof this.fetchImpl !== "function") {
      throw new Error("A fetch implementation is required.");
    }
  }

  websocketUrl() {
    const url = new URL(this.baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/api/v4/websocket";
    url.search = "";
    return url.toString();
  }

  async getMe() {
    return await this.request("GET", "/api/v4/users/me");
  }

  async createPost({ channelId, message, rootId = "" }) {
    return await this.request("POST", "/api/v4/posts", {
      channel_id: channelId,
      message,
      root_id: rootId
    });
  }

  async request(method, path, body) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Mattermost API ${method} ${path} failed with ${response.status}: ${text}`);
    }

    return await response.json();
  }
}
