/**
 * Simple structured logger. Does not log secrets or full env vars.
 * Uses console with consistent format for webhook debugging.
 */

const levels = { error: 0, warn: 1, info: 2, debug: 3 };

/**
 * @param {string} level
 * @param {string} message
 * @param {Record<string, unknown>} [meta]
 */
function log(level, message, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/**
 * @param {string} message
 * @param {Record<string, unknown>} [meta]
 */
function info(message, meta) {
  log('info', message, meta);
}

/**
 * @param {string} message
 * @param {Record<string, unknown>} [meta]
 */
function warn(message, meta) {
  log('warn', message, meta);
}

/**
 * @param {string} message
 * @param {Record<string, unknown>} [meta]
 */
function error(message, meta) {
  log('error', message, meta);
}

/**
 * @param {string} message
 * @param {Record<string, unknown>} [meta]
 */
function debug(message, meta) {
  log('debug', message, meta);
}

module.exports = { info, warn, error, debug, log };
