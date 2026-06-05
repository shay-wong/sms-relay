const LEVELS = {
  off: 0,
  silent: 0,
  error: 1,
  info: 2,
  debug: 3
};

function normalizeLogLevel(value) {
  const level = String(value || "info").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, level) ? level : "info";
}

function createLogger({ level = "info", sink = console } = {}) {
  const normalized = normalizeLogLevel(level);
  const current = LEVELS[normalized];

  return {
    level: normalized,
    debug: (...args) => {
      if (current >= LEVELS.debug) sink.log(...args);
    },
    info: (...args) => {
      if (current >= LEVELS.info) sink.log(...args);
    },
    error: (...args) => {
      if (current >= LEVELS.error) sink.error(...args);
    }
  };
}

module.exports = {
  createLogger,
  normalizeLogLevel
};
