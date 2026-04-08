const { Pool } = require('pg');
const { getConfig } = require('../config/env');

let pool = null;

function getPool() {
  if (pool) return pool;

  const config = getConfig();
  if (!config.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL in environment.');
  }

  pool = new Pool({
    connectionString: config.DATABASE_URL,
  });

  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

module.exports = { getPool, query, closePool };
