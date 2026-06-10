import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { loadLocalEnv } from "../src/bot/env.js";

test("loadLocalEnv reads env files without overriding existing process env", () => {
  const dir = join("/private/tmp", `csit-env-test-${Date.now()}`);
  mkdirSync(dir);
  const envPath = join(dir, ".env");
  writeFileSync(envPath, [
    "CSIT_ENV_TEST_VALUE=from-file",
    "CSIT_ENV_TEST_QUOTED=\"quoted value\"",
    "CSIT_ENV_TEST_EXISTING=from-file"
  ].join("\n"));

  process.env.CSIT_ENV_TEST_EXISTING = "from-process";
  delete process.env.CSIT_ENV_TEST_VALUE;
  delete process.env.CSIT_ENV_TEST_QUOTED;

  loadLocalEnv([envPath]);

  assert.equal(process.env.CSIT_ENV_TEST_VALUE, "from-file");
  assert.equal(process.env.CSIT_ENV_TEST_QUOTED, "quoted value");
  assert.equal(process.env.CSIT_ENV_TEST_EXISTING, "from-process");

  delete process.env.CSIT_ENV_TEST_EXISTING;
  delete process.env.CSIT_ENV_TEST_VALUE;
  delete process.env.CSIT_ENV_TEST_QUOTED;
  rmSync(dir, { recursive: true, force: true });
});
