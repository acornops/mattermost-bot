import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadLocalEnv } from "../src/bot/env.js";

test("loadLocalEnv reads env files without overriding existing process env", () => {
  const dir = join(tmpdir(), `acornops-env-test-${Date.now()}`);
  mkdirSync(dir);
  const envPath = join(dir, ".env");
  writeFileSync(envPath, [
    "ACORNOPS_ENV_TEST_VALUE=from-file",
    "ACORNOPS_ENV_TEST_QUOTED=\"quoted value\"",
    "ACORNOPS_ENV_TEST_EXISTING=from-file"
  ].join("\n"));

  process.env.ACORNOPS_ENV_TEST_EXISTING = "from-process";
  delete process.env.ACORNOPS_ENV_TEST_VALUE;
  delete process.env.ACORNOPS_ENV_TEST_QUOTED;

  loadLocalEnv([envPath]);

  assert.equal(process.env.ACORNOPS_ENV_TEST_VALUE, "from-file");
  assert.equal(process.env.ACORNOPS_ENV_TEST_QUOTED, "quoted value");
  assert.equal(process.env.ACORNOPS_ENV_TEST_EXISTING, "from-process");

  delete process.env.ACORNOPS_ENV_TEST_EXISTING;
  delete process.env.ACORNOPS_ENV_TEST_VALUE;
  delete process.env.ACORNOPS_ENV_TEST_QUOTED;
  rmSync(dir, { recursive: true, force: true });
});
