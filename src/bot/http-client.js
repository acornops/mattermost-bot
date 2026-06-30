export class JsonHttpClient {
  constructor({
    baseUrl,
    fetchImpl = globalThis.fetch,
    serviceName,
    missingBaseUrlMessage = "API base URL is required."
  }) {
    this.baseUrl = baseUrl?.replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
    this.serviceName = serviceName;

    if (!this.baseUrl) {
      throw new Error(missingBaseUrlMessage);
    }

    if (typeof this.fetchImpl !== "function") {
      throw new Error("A fetch implementation is required.");
    }
  }

  async requestJson(method, path, body, options = {}) {
    const response = await this.request(method, path, body, options);
    return await response.json();
  }

  async request(method, path, body, options = {}) {
    const headers = {
      "content-type": "application/json",
      ...options.headers
    };

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${this.serviceName} API ${method} ${path} failed with ${response.status}: ${text}`);
    }

    return response;
  }
}
