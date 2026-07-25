const { Pool } = require('pg');
require('dotenv').config();

const connectionString =
  process.env.DATABASE_URL || 'postgresql://localhost:5432/carf_db';

const pool = new Pool({
  connectionString,
});

module.exports = pool;
