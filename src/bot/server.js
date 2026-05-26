import http from "node:http";
import { URL } from "node:url";
import {
  handleCsitCommand,
  parseSlashCommand,
  validateSlashCommandToken
} from "./command.js";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3000;

export function createServer(options = {}) {
  return http.createServer(createRequestHandler(options));
}

export function createRequestHandler(options = {}) {
  const expectedToken = options.commandToken ?? process.env.CSIT_MATTERMOST_COMMAND_TOKEN ?? "";

  return async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

      if (request.method === "GET" && url.pathname === "/healthz") {
        return sendJson(response, 200, { status: "ok" });
      }

      if (request.method === "POST" && url.pathname === "/mattermost/slash/csit") {
        return await handleMattermostSlashCommand(request, response, expectedToken);
      }

      return sendJson(response, 404, { error: "not_found" });
    } catch (error) {
      return sendJson(response, 500, {
        error: "internal_error",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };
}

async function handleMattermostSlashCommand(request, response, expectedToken) {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return sendJson(response, 415, {
      response_type: "ephemeral",
      text: "Unsupported request content type."
    });
  }

  const body = await readRequestBody(request);
  const command = parseSlashCommand(new URLSearchParams(body));
  const tokenCheck = validateSlashCommandToken(command.token, expectedToken);

  if (!tokenCheck.ok) {
    return sendJson(response, tokenCheck.status, {
      response_type: "ephemeral",
      text: tokenCheck.message
    });
  }

  return sendJson(response, 200, handleCsitCommand(command));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) {
        reject(new Error("Request body exceeded 64 KiB."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  const json = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json)
  });
  response.end(json);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const host = process.env.CSIT_HOST || DEFAULT_HOST;
  const port = Number.parseInt(process.env.CSIT_PORT || `${DEFAULT_PORT}`, 10);

  createServer().listen(port, host, () => {
    console.log(`CSIT bot listening on http://${host}:${port}`);
    console.log("Mattermost slash command endpoint: /mattermost/slash/csit");
  });
}
