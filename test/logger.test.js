const test = require("node:test");
const assert = require("node:assert/strict");
const { createLogger, normalizeLogLevel } = require("../src/logger");

function createSink() {
  const calls = [];
  return {
    calls,
    log: (...args) => calls.push(["log", ...args]),
    error: (...args) => calls.push(["error", ...args])
  };
}

test("normalizeLogLevel defaults to info", () => {
  assert.equal(normalizeLogLevel(undefined), "info");
  assert.equal(normalizeLogLevel(""), "info");
  assert.equal(normalizeLogLevel("unknown"), "info");
});

test("logger writes info logs at info level", () => {
  const sink = createSink();
  const logger = createLogger({ level: "info", sink });

  logger.info("hello");
  logger.error("error");

  assert.deepEqual(sink.calls, [
    ["log", "hello"],
    ["error", "error"]
  ]);
});

test("logger suppresses info logs at error level", () => {
  const sink = createSink();
  const logger = createLogger({ level: "error", sink });

  logger.info("hello");
  logger.error("error");

  assert.deepEqual(sink.calls, [
    ["error", "error"]
  ]);
});

test("logger can be silenced", () => {
  const sink = createSink();
  const logger = createLogger({ level: "off", sink });

  logger.info("hello");
  logger.error("error");

  assert.deepEqual(sink.calls, []);
});
