export class AcornOpsClient {
  constructor({ baseUrl, fetchImpl = globalThis.fetch }) {
    this.baseUrl = baseUrl?.replace(/\/$/, "");
    this.fetchImpl = fetchImpl;

    if (!this.baseUrl) {
      throw new Error("CSIT_ACORNOPS_URL is required.");
    }

    if (typeof this.fetchImpl !== "function") {
      throw new Error("A fetch implementation is required.");
    }
  }

  async devLogin({ email, name }) {
    const response = await this.request("POST", "/api/v1/auth/dev-login", {
      email,
      name
    });
    const sessionCookie = extractCookie(response.headers, "acornops_cp_session");

    return {
      ...await response.json(),
      sessionCookie
    };
  }

  async request(method, path, body) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AcornOps API ${method} ${path} failed with ${response.status}: ${text}`);
    }

    return response;
  }
}

export function mattermostDevLoginEmail(userId) {
  return `mattermost-${sanitizeMattermostUserId(userId)}@csit.local`;
}

function sanitizeMattermostUserId(userId) {
  return String(userId || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function extractCookie(headers, name) {
  const cookieHeader = headers?.get?.("set-cookie");
  if (!cookieHeader) {
    return "";
  }

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`)) ?? "";
}
