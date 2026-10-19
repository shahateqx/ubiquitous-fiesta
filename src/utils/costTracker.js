'use strict';
const { query } = require('../data/db');

/**
 * Log an AI API call cost to the cost_log table.
 *
 * @param {object} opts
 * @param {'vision'|'embedding'} opts.callType
 * @param {string} opts.model
 * @param {number} [opts.tokensUsed]
 * @param {number} [opts.estimatedCost]
 * @param {number|null} [opts.relatedId]  - image_id or post_id
 */
async function logCost({ callType, model, tokensUsed = 0, estimatedCost = 0, relatedId = null }) {
  try {
    await query(
      `INSERT INTO cost_log (call_type, model, tokens_used, estimated_cost, related_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [callType, model, tokensUsed, estimatedCost, relatedId]
    );
  } catch (err) {
    // Cost logging failure should never crash the main flow
    console.error('[costTracker] Failed to log cost:', err.message);
  }
}

/**
 * Get a summary of all costs grouped by call type.
 */
async function getCostSummary() {
  const { rows } = await query(`
    SELECT
      call_type,
      model,
      COUNT(*)          AS calls,
      SUM(tokens_used)  AS total_tokens,
      SUM(estimated_cost) AS total_cost
    FROM cost_log
    GROUP BY call_type, model
    ORDER BY call_type, model
  `);
  return rows;
}

/**
 * Get recent cost log entries.
 * @param {number} [limit=100]
 */
async function getCostLog(limit = 100) {
  const { rows } = await query(
    'SELECT * FROM cost_log ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  return rows;
}

module.exports = { logCost, getCostSummary, getCostLog };
