import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import http from "node:http";

const MAX_BODY_BYTES = 1024 * 1024;
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export function createBotHttpServer({
  host = "0.0.0.0",
  port = 0,
  mattermostActionSecret = "",
  commandContextStore,
  mattermostClient,
  logger = console
}) {
  const server = http.createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url ?? "/", "http://localhost");
      if (req.method === "GET" && pathname === "/healthz") {
        sendJson(res, 200, { status: "ok" });
        return;
      }

      if (req.method === "POST" && pathname === "/mattermost/actions") {
        const rawBody = await readBody(req);
        const payload = parseJson(rawBody);
        const result = handleMattermostAction({
          payload,
          mattermostActionSecret,
          commandContextStore
        });
        sendJson(res, result.status, result.body);
        return;
      }

      const routeToken = routeTokenFromPath(pathname);
      if (req.method === "POST" && routeToken) {
        const rawBody = await readBody(req);
        const result = await handleAcornOpsRouteWebhook({
          routeToken,
          rawBody,
          headers: req.headers,
          commandContextStore,
          mattermostClient
        });
        sendJson(res, result.status, result.body);
        return;
      }

      sendJson(res, 404, { error: "not_found" });
    } catch (error) {
      logger.error(error instanceof Error ? error.message : error);
      sendJson(res, error.statusCode ?? 500, {
        error: error.statusCode ? "bad_request" : "internal_error"
      });
    }
  });

  return {
    server,
    start() {
      if (!port) {
        return Promise.resolve(null);
      }
      return new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          server.off("error", onError);
          logger.log(`AcornOps bot HTTP server listening on ${host}:${port}`);
          resolve(server);
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, host);
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}

export function handleMattermostAction({
  payload,
  mattermostActionSecret,
  commandContextStore
}) {
  const context = payload.context ?? {};
  if (mattermostActionSecret && context.secret !== mattermostActionSecret) {
    return {
      status: 200,
      body: {
        error: {
          message: "This action is not authorized."
        }
      }
    };
  }

  if (context.action !== "select_workspace") {
    return {
      status: 200,
      body: {
        error: {
          message: "Unknown AcornOps action."
        }
      }
    };
  }

  const actingUserId = payload.user_id ?? payload.userId ?? "";
  if (!actingUserId || actingUserId !== context.externalUserId) {
    return {
      status: 200,
      body: {
        error: {
          message: "Only the Mattermost user who requested this list can select from it."
        }
      }
    };
  }

  const workspace = context.workspace ?? {};
  if (!workspace.id) {
    return {
      status: 200,
      body: {
        error: {
          message: "Workspace selection is missing a workspace id."
        }
      }
    };
  }

  commandContextStore.selectWorkspace(actingUserId, workspace);
  return {
    status: 200,
    body: {
      ephemeral_text: `Current workspace updated: ${workspace.name || workspace.id}`
    }
  };
}

export async function handleAcornOpsRouteWebhook({
  routeToken,
  rawBody,
  headers,
  commandContextStore,
  mattermostClient
}) {
  const routeTokenHash = hashSecret(routeToken);
  const route = commandContextStore.getWebhookRouteByTokenHash?.(routeTokenHash);
  if (!route || !route.signingSecret) {
    return {
      status: 404,
      body: { error: "webhook_route_not_found" }
    };
  }

  const timestamp = headerValue(headers, "acornops-timestamp");
  const signature = headerValue(headers, "acornops-signature").replace(/^v1=/, "");
  if (!validWebhookTimestamp(timestamp) || !validSignature({ secret: route.signingSecret, timestamp, rawBody, signature })) {
    return {
      status: 401,
      body: { error: "invalid_signature" }
    };
  }

  const payload = parseJson(rawBody);
  const eventId = headerValue(headers, "acornops-event-id") || payload.id || "";
  if (!eventId) {
    return {
      status: 400,
      body: { error: "missing_event_id" }
    };
  }

  const firstSeen = await commandContextStore.rememberInboundEvent?.(eventId);
  if (!firstSeen) {
    return {
      status: 202,
      body: { status: "duplicate" }
    };
  }

  await mattermostClient.createPost({
    channelId: route.channelId,
    rootId: route.rootId,
    message: formatWebhookAlert(payload)
  });
  return {
    status: 202,
    body: { status: "posted" }
  };
}

function formatWebhookAlert(payload) {
  const subject = payload.subject
    ? `${payload.subject.type ?? "subject"} ${payload.subject.id ?? ""}`.trim()
    : "event";
  const lines = [
    "AcornOps alert:",
    `- Type: ${payload.type ?? "unknown"}`,
    `- Subject: ${subject}`,
    `- Workspace: ${payload.workspaceId ?? "unknown"}`
  ];
  if (payload.targetId || payload.clusterId) {
    lines.push(`- Target: ${payload.targetId ?? payload.clusterId}`);
  }
  if (payload.occurredAt) {
    lines.push(`- Occurred: ${payload.occurredAt}`);
  }
  const message = payload.data?.message ?? payload.data?.errorMessage ?? "";
  if (message) {
    lines.push(`- Message: ${String(message).replace(/\s+/g, " ").trim().slice(0, 500)}`);
  }
  return lines.join("\n");
}

function validWebhookTimestamp(timestamp) {
  const value = Number.parseInt(timestamp, 10);
  if (!Number.isInteger(value)) {
    return false;
  }
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - value);
  return ageSeconds <= WEBHOOK_TOLERANCE_SECONDS;
}

function validSignature({ secret, timestamp, rawBody, signature }) {
  if (!signature) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return safeEqual(signature, expected);
}

export function hashSecret(secret) {
  return createHash("sha256").update(secret).digest("hex");
}

export function routeTokenFromPath(pathname) {
  const prefix = "/acornops/webhooks/routes/";
  if (!pathname.startsWith(prefix)) {
    return "";
  }
  return decodeURIComponent(pathname.slice(prefix.length));
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function headerValue(headers, name) {
  const value = headers[name] ?? "";
  return Array.isArray(value) ? value[0] ?? "" : String(value);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.byteLength;
    if (size > MAX_BODY_BYTES) {
      throw new Error("Request body too large.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseJson(rawBody) {
  try {
    return JSON.parse(rawBody || "{}");
  } catch {
    const error = new Error("Invalid JSON body.");
    error.statusCode = 400;
    throw error;
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json"
  });
  res.end(JSON.stringify(body));
}
