'use strict';
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client', err);
});

/**
 * Execute a query against the pool.
 * @param {string} text - SQL query string
 * @param {Array} [params] - Query parameters
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[db] query (${duration}ms) rows=${res.rowCount}`);
    }
    return res;
  } catch (err) {
    console.error('[db] query error', { text, error: err.message });
    throw err;
  }
}

module.exports = { pool, query };
