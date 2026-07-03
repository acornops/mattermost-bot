import { JsonHttpClient } from "./http-client.js";

export class MattermostClient {
  constructor({ baseUrl, token, fetchImpl = globalThis.fetch }) {
    this.http = new JsonHttpClient({
      baseUrl,
      fetchImpl,
      serviceName: "Mattermost",
      missingBaseUrlMessage: "MATTERMOST_URL is required."
    });
    this.token = token;

    if (!this.token) {
      throw new Error("MATTERMOST_BOT_TOKEN is required.");
    }
  }

  websocketUrl() {
    const url = new URL(this.http.baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/api/v4/websocket";
    url.search = "";
    return url.toString();
  }

  async getMe() {
    return await this.requestJson("GET", "/api/v4/users/me");
  }

  async createPost({ channelId, message, rootId = "", props = undefined, attachments = undefined }) {
    const body = {
      channel_id: channelId,
      message,
      root_id: rootId
    };
    if (props) {
      body.props = props;
    }
    if (attachments) {
      body.props = {
        ...body.props,
        attachments
      };
    }
    return await this.requestJson("POST", "/api/v4/posts", body);
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
    return {
      ...options.headers,
      authorization: `Bearer ${this.token}`
    };
  }
}
