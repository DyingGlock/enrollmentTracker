/**
 * Environment configuration loader.
 * Loads from process.env; use dotenv in development if desired.
 * Never log secrets (TRELLO_KEY, TRELLO_TOKEN, service account JSON).
 */

const path = require('path');

/**
 * Load optional .env file in development (no-op if dotenv not installed).
 * Does not fail if .env is missing.
 */
function loadEnv() {
  try {
    const dotenv = require('dotenv');
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  } catch (e) {
    // dotenv not installed; rely on process.env only
  }
}

loadEnv();

/**
 * @typedef {Object} EnvConfig
 * @property {number} PORT
 * @property {string} NODE_ENV
 * @property {string} LOG_LEVEL
 * @property {string} TRELLO_KEY
 * @property {string} TRELLO_TOKEN
 * @property {string} DATABASE_URL
 * @property {string} CURRENT_CLASS_LABEL
 * @property {string} TRELLO_BOARD_ID
 * @property {string} TRELLO_CLASS_CARD_ID
 * @property {number} TRELLO_SYNC_INTERVAL_MS
 */

/**
 * Get validated config from environment.
 * @returns {EnvConfig}
 */
function getConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const defaultPort = nodeEnv === 'production' ? '3003' : '5003';
  const port = parseInt(process.env.PORT || defaultPort, 10);

  return {
    PORT: Number.isNaN(port) ? Number(defaultPort) : port,
    NODE_ENV: nodeEnv,
    LOG_LEVEL: (process.env.LOG_LEVEL || 'info').toLowerCase(),
    TRELLO_KEY: process.env.TRELLO_KEY || '',
    TRELLO_TOKEN: process.env.TRELLO_TOKEN || '',
    DATABASE_URL: process.env.DATABASE_URL || '',
    CURRENT_CLASS_LABEL: process.env.CURRENT_CLASS_LABEL || 'Unassigned Class',
    TRELLO_BOARD_ID:
      process.env.TRELLO_BOARD_ID || '5a46fb92d46aeb4f84445b53',
    TRELLO_CLASS_CARD_ID:
      process.env.TRELLO_CLASS_CARD_ID || '668c60d1fefc661ba4da67fe',
    TRELLO_SYNC_INTERVAL_MS: Number.parseInt(
      process.env.TRELLO_SYNC_INTERVAL_MS || '60000',
      10
    ),
  };
}

module.exports = { getConfig, loadEnv };
