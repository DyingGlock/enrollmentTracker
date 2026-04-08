const fs = require('fs/promises');
const path = require('path');
const { query } = require('./index');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function migrate() {
  const entries = await fs.readdir(MIGRATIONS_DIR);
  const migrationFiles = entries
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  for (const file of migrationFiles) {
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    await query(sql);
  }
}

module.exports = { migrate };
