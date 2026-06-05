function normalizePath(value, defaultPath) {
  const raw = String(value || "").trim();
  if (!raw) return defaultPath;
  if (raw === "/") return "/";

  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function normalizeWebhookPath(value) {
  return normalizePath(value, "/sms");
}

function isConfiguredPath(pathname, configuredPath) {
  return pathname === configuredPath;
}

module.exports = {
  normalizePath,
  normalizeWebhookPath,
  isConfiguredPath
};
