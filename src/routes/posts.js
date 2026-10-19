'use strict';
const express = require('express');
const { z } = require('zod');
const { query } = require('../data/db');
const { embedPost } = require('../services/embeddingService');
const { rankImagesForPost } = require('../services/matchingService');
const { mismatchGuard } = require('../services/guardService');
const validate = require('../middleware/validate');

const router = express.Router();

// ── Schemas ──────────────────────────────────────────────────────────────────
const CreatePostSchema = z.object({
  title:   z.string().min(1),
  content: z.string().min(1),
});

// POST /posts — Create a blog post and immediately embed it
router.post('/', validate(CreatePostSchema), async (req, res, next) => {
  try {
    const { title, content } = req.body;
    const { rows } = await query(
      'INSERT INTO posts (title, content) VALUES ($1, $2) RETURNING *',
      [title, content]
    );
    const post = rows[0];

    // Embed immediately (could also be deferred to a queue)
    try {
      await embedPost(post.id, post.title, post.content);
    } catch (embedErr) {
      console.warn(`[posts] Embedding failed for post ${post.id}:`, embedErr.message);
    }

    res.status(201).json({ success: true, post });
  } catch (err) {
    next(err);
  }
});

// GET /posts — List all posts
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM posts ORDER BY created_at DESC');
    res.json({ success: true, posts: rows });
  } catch (err) {
    next(err);
  }
});

// GET /posts/:id — Get single post
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    res.json({ success: true, post: rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /posts/:id/images — Ranked image suggestions for a post
router.get('/:id/images', async (req, res, next) => {
  try {
    const postId = parseInt(req.params.id, 10);
    const topN = parseInt(req.query.top || '5', 10);

    // Load post
    const { rows: postRows } = await query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    const post = postRows[0];

    // Rank images
    const ranked = await rankImagesForPost(postId, topN);
    if (ranked.length === 0) {
      return res.json({
        success: true,
        post: { id: post.id, title: post.title },
        suggestions: [],
        message: 'No tagged images with embeddings found.',
      });
    }

    // Load image details + tags for guard
    const imageIds = ranked.map(r => r.imageId);
    const { rows: imageRows } = await query(`
      SELECT
        i.id, i.filename, i.url, i.status,
        it.subject, it.category, it.attributes, it.caption, it.confidence
      FROM images i
      LEFT JOIN image_tags it ON it.image_id = i.id
      WHERE i.id = ANY($1::int[])
    `, [imageIds]);

    // Build a map for quick lookup
    const imageMap = Object.fromEntries(imageRows.map(r => [r.id, r]));

    // Apply guard and save suggestions
    const suggestions = [];
    for (const { imageId, score } of ranked) {
      const img = imageMap[imageId];
      if (!img) continue;

      const tag = {
        subject:    img.subject    || '',
        category:   img.category   || 'other',
        attributes: img.attributes || [],
        caption:    img.caption    || '',
        confidence: img.confidence || 0,
      };

      const guard = mismatchGuard(post, tag, score);

      // Upsert suggestion (delete + insert for simplicity)
      const { rows: suggRows } = await query(`
        INSERT INTO suggestions (post_id, image_id, similarity_score, guard_passed, guard_reason, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [postId, imageId, score, guard.passed, guard.reason]);

      let suggestionId = suggRows[0]?.id;
      if (!suggestionId) {
        // Already exists — update score
        const { rows: existing } = await query(
          `UPDATE suggestions SET similarity_score=$3, guard_passed=$4, guard_reason=$5
           WHERE post_id=$1 AND image_id=$2 RETURNING id`,
          [postId, imageId, score, guard.passed, guard.reason]
        );
        suggestionId = existing[0]?.id;
      }

      suggestions.push({
        suggestionId,
        imageId,
        filename: img.filename,
        url: img.url,
        subject: tag.subject,
        category: tag.category,
        caption: tag.caption,
        confidence: tag.confidence,
        similarityScore: parseFloat(score.toFixed(4)),
        guardPassed: guard.passed,
        guardReason: guard.reason,
      });
    }

    res.json({
      success: true,
      post: { id: post.id, title: post.title },
      totalCandidates: ranked.length,
      suggestions,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
