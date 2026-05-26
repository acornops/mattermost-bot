import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createRequestHandler } from "../src/bot/server.js";

test("GET /healthz returns ok", async () => {
  const response = await dispatch({
    method: "GET",
    url: "/healthz"
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json, { status: "ok" });
});

test("POST /mattermost/slash/csit handles valid slash command", async () => {
  const response = await dispatch({
    method: "POST",
    url: "/mattermost/slash/csit",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      token: "secret",
      user_id: "user-1",
      user_name: "alice",
      command: "/csit",
      text: "status"
    }).toString(),
    options: {
      commandToken: "secret"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.response_type, "ephemeral");
  assert.match(response.json.text, /alice \(user-1\)/);
});

test("POST /mattermost/slash/csit rejects invalid token", async () => {
  const response = await dispatch({
    method: "POST",
    url: "/mattermost/slash/csit",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      token: "wrong",
      user_id: "user-1",
      command: "/csit",
      text: "status"
    }).toString(),
    options: {
      commandToken: "secret"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.match(response.json.text, /Invalid Mattermost slash command token/);
});

async function dispatch({ method, url, headers = {}, body = "", options = {} }) {
  const request = new FakeRequest({
    method,
    url,
    headers: {
      host: "localhost",
      ...headers
    },
    body
  });
  const response = new FakeResponse();
  const handler = createRequestHandler(options);

  const handled = handler(request, response);
  request.flush();
  await handled;

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body,
    json: JSON.parse(response.body)
  };
}

class FakeRequest extends EventEmitter {
  constructor({ method, url, headers, body }) {
    super();
    this.method = method;
    this.url = url;
    this.headers = headers;
    this.body = body;
  }

  setEncoding() {}

  destroy() {}

  flush() {
    queueMicrotask(() => {
      if (this.body) {
        this.emit("data", this.body);
      }

      this.emit("end");
    });
  }
}

class FakeResponse {
  statusCode = 200;
  headers = {};
  body = "";

  writeHead(statusCode, headers) {
    this.statusCode = statusCode;
    this.headers = headers;
  }

  end(body = "") {
    this.body = body;
  }
}
