const crypto = require("node:crypto");

function normalizePart(value) {
  return String(value || "").trim();
}

function fingerprintMessage(message) {
  const payload = [
    normalizePart(message.info),
    normalizePart(message.content),
    normalizePart(message.recipient),
    normalizePart(message.sender),
    normalizePart(message.name)
  ];

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

function createDedupeStore({ ttlMs, now = () => Date.now() }) {
  const entries = new Map();
  const effectiveTtlMs = Math.max(0, Number(ttlMs || 0));

  function prune(currentTime) {
    for (const [fingerprint, expiresAt] of entries) {
      if (expiresAt <= currentTime) {
        entries.delete(fingerprint);
      }
    }
  }

  function check(message) {
    if (effectiveTtlMs === 0) {
      return { duplicate: false, fingerprint: fingerprintMessage(message), expiresInMs: 0 };
    }

    const currentTime = now();
    prune(currentTime);

    const fingerprint = fingerprintMessage(message);
    const existingExpiresAt = entries.get(fingerprint);
    if (existingExpiresAt && existingExpiresAt > currentTime) {
      return {
        duplicate: true,
        fingerprint,
        expiresInMs: existingExpiresAt - currentTime
      };
    }

    entries.set(fingerprint, currentTime + effectiveTtlMs);
    return {
      duplicate: false,
      fingerprint,
      expiresInMs: effectiveTtlMs
    };
  }

  return {
    check,
    size: () => entries.size
  };
}

module.exports = {
  createDedupeStore,
  fingerprintMessage
};
