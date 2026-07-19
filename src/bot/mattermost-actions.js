import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = 1;
const DEFAULT_ACTION_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DIALOG_TTL_MS = 15 * 60 * 1000;

export function signMattermostActionContext(value, secret, {
  now = Date.now(),
  expiresAt = now + DEFAULT_ACTION_TTL_MS
} = {}) {
  return signMattermostContext(value, secret, {
    purpose: "mattermost_action",
    now,
    expiresAt
  });
}

export function verifyMattermostActionContext(token, secret, options = {}) {
  return verifyMattermostContext(token, secret, {
    ...options,
    purpose: "mattermost_action"
  });
}

export function signApprovalDialogState(value, secret, {
  now = Date.now(),
  expiresAt = now + DEFAULT_DIALOG_TTL_MS
} = {}) {
  return signMattermostContext(value, secret, {
    purpose: "approval_dialog",
    now,
    expiresAt
  });
}

export function verifyApprovalDialogState(token, secret, options = {}) {
  return verifyMattermostContext(token, secret, {
    ...options,
    purpose: "approval_dialog"
  });
}

function signMattermostContext(value, secret, {
  purpose,
  now,
  expiresAt
}) {
  if (!secret || !value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }
  const envelope = {
    version: TOKEN_VERSION,
    purpose,
    issuedAt: Math.floor(now / 1000),
    expiresAt: Math.floor(expiresAt / 1000),
    value
  };
  const encoded = Buffer.from(JSON.stringify(envelope)).toString("base64url");
  return `${encoded}.${signatureFor(encoded, secret)}`;
}

function verifyMattermostContext(token, secret, {
  purpose,
  now = Date.now()
}) {
  if (!token || !secret) {
    return null;
  }
  const [encoded, signature, extra] = String(token).split(".");
  if (!encoded || !signature || extra) {
    return null;
  }
  const expected = signatureFor(encoded, secret);
  if (!safeEqual(signature, expected)) {
    return null;
  }

  try {
    const envelope = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (envelope.version !== TOKEN_VERSION
      || envelope.purpose !== purpose
      || !Number.isSafeInteger(envelope.issuedAt)
      || !Number.isSafeInteger(envelope.expiresAt)
      || envelope.issuedAt > Math.floor(now / 1000) + 60
      || envelope.expiresAt < Math.floor(now / 1000)
      || !envelope.value
      || typeof envelope.value !== "object"
      || Array.isArray(envelope.value)) {
      return null;
    }
    return envelope.value;
  } catch {
    return null;
  }
}

function signatureFor(encoded, secret) {
  return createHmac("sha256", secret).update(encoded).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length
    && timingSafeEqual(leftBuffer, rightBuffer);
}
