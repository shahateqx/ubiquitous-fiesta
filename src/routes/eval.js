'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const { query } = require('../data/db');
const { rankImagesForPost } = require('../services/matchingService');
const { mismatchGuard } = require('../services/guardService');

const router = express.Router();

// In-memory store for latest eval run result
let latestEvalResult = null;

/**
 * POST /eval — Run evaluation against labeled eval set.
 * Body can optionally contain { evalSet: [...] } or falls back to data/eval.json.
 */
router.post('/', async (req, res, next) => {
  try {
    let evalSet = req.body.evalSet;

    if (!evalSet) {
      const evalPath = path.join(process.cwd(), 'data', 'eval.json');
      if (!fs.existsSync(evalPath)) {
        return res.status(404).json({ success: false, error: 'data/eval.json not found' });
      }
      evalSet = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
    }

    const results = [];
    let hits = 0;

    for (const item of evalSet) {
      const { post_id, correct_image_filename } = item;

      // Load the post
      const { rows: postRows } = await query('SELECT * FROM posts WHERE id = $1', [post_id]);
      if (postRows.length === 0) {
        results.push({ post_id, error: 'Post not found', top1_correct: false });
        continue;
      }
      const post = postRows[0];

      // Rank images
      let ranked;
      try {
        ranked = await rankImagesForPost(post_id, 5);
      } catch (err) {
        results.push({ post_id, error: err.message, top1_correct: false });
        continue;
      }

      if (ranked.length === 0) {
        results.push({ post_id, title: post.title, error: 'No ranked images', top1_correct: false });
        continue;
      }

      // Load image details for top result
      const { imageId: top1ImageId, score: top1Score } = ranked[0];
      const { rows: imgRows } = await query(`
        SELECT i.filename, it.subject, it.category, it.confidence
        FROM images i
        LEFT JOIN image_tags it ON it.image_id = i.id
        WHERE i.id = $1
      `, [top1ImageId]);

      const topImage = imgRows[0];
      const top1Correct = topImage?.filename === correct_image_filename;

      // Check guard on top-1
      const tag = {
        subject:    topImage?.subject    || '',
        category:   topImage?.category   || 'other',
        confidence: topImage?.confidence || 0,
        attributes: [],
        caption: '',
      };
      const guard = mismatchGuard(post, tag, top1Score);

      if (top1Correct) hits++;

      results.push({
        post_id,
        title: post.title,
        correct_image_filename,
        top1_image_filename: topImage?.filename || null,
        top1_score: parseFloat(top1Score.toFixed(4)),
        top1_correct,
        guard_passed: guard.passed,
        guard_reason: guard.reason,
      });
    }

    const precision = evalSet.length > 0 ? hits / evalSet.length : 0;

    latestEvalResult = {
      run_at: new Date().toISOString(),
      total: evalSet.length,
      hits,
      top1_precision: parseFloat(precision.toFixed(4)),
      results,
    };

    res.json({ success: true, evaluation: latestEvalResult });
  } catch (err) {
    next(err);
  }
});

// GET /eval/results — Return latest eval run
router.get('/results', (req, res) => {
  if (!latestEvalResult) {
    return res.status(404).json({
      success: false,
      error: 'No evaluation has been run yet. POST /eval to run.',
    });
  }
  res.json({ success: true, evaluation: latestEvalResult });
});

module.exports = router;
