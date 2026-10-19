'use strict';
const express = require('express');
const { getCostSummary, getCostLog } = require('../utils/costTracker');

const router = express.Router();

// GET /cost — Cost log summary
router.get('/', async (req, res, next) => {
  try {
    const [summary, recent] = await Promise.all([
      getCostSummary(),
      getCostLog(50),
    ]);

    // Grand totals
    const totalCalls = summary.reduce((acc, r) => acc + parseInt(r.calls), 0);
    const totalTokens = summary.reduce((acc, r) => acc + parseInt(r.total_tokens || 0), 0);
    const totalCost = summary.reduce((acc, r) => acc + parseFloat(r.total_cost || 0), 0);

    res.json({
      success: true,
      summary,
      totals: {
        calls: totalCalls,
        tokens: totalTokens,
        estimated_cost_usd: parseFloat(totalCost.toFixed(6)),
      },
      recent_logs: recent,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
