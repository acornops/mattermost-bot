import assert from "node:assert/strict";
import test from "node:test";
import { JsonHttpClient } from "../src/bot/http-client.js";

test("JsonHttpClient sends JSON bodies and trims base URL slashes", async () => {
  const requests = [];
  const client = new JsonHttpClient({
    baseUrl: "http://service/",
    serviceName: "Service",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return okResponse({ accepted: true });
    }
  });

  const result = await client.requestJson("POST", "/items", { name: "demo" }, {
    headers: {
      authorization: "Bearer token"
    }
  });

  assert.deepEqual(result, { accepted: true });
  assert.equal(requests[0].url, "http://service/items");
  assert.equal(requests[0].options.headers["content-type"], "application/json");
  assert.equal(requests[0].options.headers.authorization, "Bearer token");
  assert.deepEqual(JSON.parse(requests[0].options.body), { name: "demo" });
});

test("JsonHttpClient leaves GET bodies undefined", async () => {
  const requests = [];
  const client = new JsonHttpClient({
    baseUrl: "http://service",
    serviceName: "Service",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return okResponse({});
    }
  });

  await client.request("GET", "/items");

  assert.equal(requests[0].options.body, undefined);
});

test("JsonHttpClient includes response text in failures", async () => {
  const client = new JsonHttpClient({
    baseUrl: "http://service",
    serviceName: "Service",
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      async text() {
        return "temporarily unavailable";
      }
    })
  });

  await assert.rejects(
    client.request("GET", "/health"),
    /Service API GET \/health failed with 503: temporarily unavailable/
  );
});

function okResponse(json) {
  return {
    ok: true,
    async json() {
      return json;
    }
  };
}
