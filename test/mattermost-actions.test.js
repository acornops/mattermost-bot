import assert from "node:assert/strict";
import test from "node:test";
import {
  signApprovalDialogState,
  signMattermostActionContext,
  verifyApprovalDialogState,
  verifyMattermostActionContext
} from "../src/bot/mattermost-actions.js";

test("Mattermost action tokens keep the secret server-side and reject tampering", () => {
  const now = Date.UTC(2026, 6, 19, 0, 0, 0);
  const token = signMattermostActionContext(
    { action: "select_workspace", externalUserId: "user-1" },
    "server-secret",
    { now, expiresAt: now + 60_000 }
  );

  assert.doesNotMatch(token, /server-secret/);
  assert.deepEqual(
    verifyMattermostActionContext(token, "server-secret", { now }),
    { action: "select_workspace", externalUserId: "user-1" }
  );
  assert.equal(
    verifyMattermostActionContext(`${token.slice(0, -1)}x`, "server-secret", { now }),
    null
  );
  assert.equal(verifyMattermostActionContext(token, "wrong-secret", { now }), null);
});

test("Mattermost action and approval dialog tokens are expiring and purpose-bound", () => {
  const now = Date.UTC(2026, 6, 19, 0, 0, 0);
  const expiresAt = now + 1_000;
  const action = signMattermostActionContext(
    { action: "request_approval_decision" },
    "server-secret",
    { now, expiresAt }
  );
  const dialog = signApprovalDialogState(
    { decision: "approved" },
    "server-secret",
    { now, expiresAt }
  );

  assert.equal(verifyMattermostActionContext(action, "server-secret", { now: expiresAt + 1_000 }), null);
  assert.equal(verifyApprovalDialogState(action, "server-secret", { now }), null);
  assert.equal(verifyMattermostActionContext(dialog, "server-secret", { now }), null);
  assert.deepEqual(
    verifyApprovalDialogState(dialog, "server-secret", { now }),
    { decision: "approved" }
  );
});
