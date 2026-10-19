'use strict';
const express = require('express');
const { z } = require('zod');
const { query } = require('../data/db');
const { addImageJob, addBatchImageJobs } = require('../jobs/imageQueue');
const validate = require('../middleware/validate');

const router = express.Router();

// ── Schemas ──────────────────────────────────────────────────────────────────
const CreateImageSchema = z.object({
  filename: z.string().min(1),
  url: z.string().url(),
});

// POST /images — Register a single image
router.post('/', validate(CreateImageSchema), async (req, res, next) => {
  try {
    const { filename, url } = req.body;
    const { rows } = await query(
      "INSERT INTO images (filename, url, status) VALUES ($1, $2, 'pending') RETURNING *",
      [filename, url]
    );
    const image = rows[0];

    // Trigger processing job immediately
    await addImageJob({ imageId: image.id, imageUrl: image.url });

    res.status(201).json({ success: true, image });
  } catch (err) {
    next(err);
  }
});

// GET /images — List all images with their tags
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        i.*,
        json_agg(json_build_object(
          'id',         it.id,
          'subject',    it.subject,
          'category',   it.category,
          'attributes', it.attributes,
          'caption',    it.caption,
          'confidence', it.confidence
        )) FILTER (WHERE it.id IS NOT NULL) AS tags
      FROM images i
      LEFT JOIN image_tags it ON it.image_id = i.id
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `);
    res.json({ success: true, images: rows });
  } catch (err) {
    next(err);
  }
});

// GET /images/:id — Get single image with full tag details
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(`
      SELECT
        i.*,
        json_agg(json_build_object(
          'id',           it.id,
          'subject',      it.subject,
          'category',     it.category,
          'attributes',   it.attributes,
          'caption',      it.caption,
          'confidence',   it.confidence,
          'raw_response', it.raw_response,
          'created_at',   it.created_at
        )) FILTER (WHERE it.id IS NOT NULL) AS tags
      FROM images i
      LEFT JOIN image_tags it ON it.image_id = i.id
      WHERE i.id = $1
      GROUP BY i.id
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }
    res.json({ success: true, image: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /images/batch — Trigger batch processing for all pending images
router.post('/batch', async (req, res, next) => {
  try {
    // Find all pending images (or all images if force=true)
    const force = req.query.force === 'true';
    const whereClause = force ? '' : "WHERE status = 'pending'";
    const { rows } = await query(`SELECT id, url FROM images ${whereClause}`);

    if (rows.length === 0) {
      return res.json({ success: true, message: 'No pending images to process', queued: 0 });
    }

    const jobsData = rows.map(r => ({ imageId: r.id, imageUrl: r.url }));
    const jobs = await addBatchImageJobs(jobsData);

    res.json({
      success: true,
      message: `Queued ${jobs.length} image(s) for processing`,
      queued: jobs.length,
      jobIds: jobs.map(j => j.id),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
