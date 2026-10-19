'use strict';
const express = require('express');
const { z } = require('zod');
const { query } = require('../data/db');
const validate = require('../middleware/validate');

const router = express.Router();

const RejectSchema = z.object({
  reason: z.string().min(1).optional().default('Rejected by reviewer'),
});

// GET /suggestions — List all suggestions
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE s.status = $${params.length}`;
    }

    const { rows } = await query(`
      SELECT
        s.*,
        i.filename, i.url,
        p.title AS post_title,
        it.subject, it.category, it.caption, it.confidence
      FROM suggestions s
      JOIN images i ON i.id = s.image_id
      JOIN posts  p ON p.id = s.post_id
      LEFT JOIN image_tags it ON it.image_id = s.image_id
      ${where}
      ORDER BY s.created_at DESC
    `, params);

    res.json({ success: true, suggestions: rows });
  } catch (err) {
    next(err);
  }
});

// GET /suggestions/:id — Get single suggestion with full context
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        s.*,
        i.filename, i.url, i.status AS image_status,
        p.title AS post_title, p.content AS post_content,
        it.subject, it.category, it.attributes, it.caption, it.confidence, it.raw_response
      FROM suggestions s
      JOIN images i ON i.id = s.image_id
      JOIN posts  p ON p.id = s.post_id
      LEFT JOIN image_tags it ON it.image_id = s.image_id
      WHERE s.id = $1
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Suggestion not found' });
    }
    res.json({ success: true, suggestion: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /suggestions/:id/approve — Approve a suggestion
router.post('/:id/approve', async (req, res, next) => {
  try {
    const { rows } = await query(
      "UPDATE suggestions SET status = 'approved' WHERE id = $1 AND status = 'pending' RETURNING *",
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Suggestion not found or already reviewed',
      });
    }
    res.json({ success: true, suggestion: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /suggestions/:id/reject — Reject a suggestion with optional reason
router.post('/:id/reject', validate(RejectSchema), async (req, res, next) => {
  try {
    const reason = req.body.reason || 'Rejected by reviewer';

    const { rows } = await query(
      `UPDATE suggestions
       SET status = 'rejected', guard_reason = $2
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [req.params.id, reason]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Suggestion not found or already reviewed',
      });
    }
    res.json({ success: true, suggestion: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
