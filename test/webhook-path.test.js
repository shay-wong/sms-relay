const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizePath, normalizeWebhookPath, isConfiguredPath } = require("../src/webhook-path");

test("normalizePath returns the configured default path", () => {
  assert.equal(normalizePath(undefined, "/health"), "/health");
  assert.equal(normalizePath("", "/bot/v1/message/send"), "/bot/v1/message/send");
});

test("normalizeWebhookPath defaults to /sms", () => {
  assert.equal(normalizeWebhookPath(undefined), "/sms");
  assert.equal(normalizeWebhookPath(""), "/sms");
});

test("normalizeWebhookPath accepts the root path", () => {
  assert.equal(normalizeWebhookPath("/"), "/");
});

test("normalizeWebhookPath adds a leading slash", () => {
  assert.equal(normalizeWebhookPath("sms"), "/sms");
});

test("normalizeWebhookPath removes a trailing slash except for root", () => {
  assert.equal(normalizeWebhookPath("/sms/"), "/sms");
  assert.equal(normalizeWebhookPath("/"), "/");
});

test("isConfiguredPath matches the configured path", () => {
  assert.equal(isConfiguredPath("/sms", "/sms"), true);
  assert.equal(isConfiguredPath("/", "/"), true);
  assert.equal(isConfiguredPath("/health", "/"), false);
  assert.equal(isConfiguredPath("/sms", "/"), false);
});
