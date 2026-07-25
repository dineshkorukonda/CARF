const fs = require('fs');
const path = require('path');
const pool = require('./client');

async function runMigrations() {
  try {
    const sqlPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log('[DB] Migrations executed successfully.');
  } catch (err) {
    console.error('[DB] Error running migrations:', err);
    throw err;
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .catch(() => process.exit(1));
}

module.exports = runMigrations;
