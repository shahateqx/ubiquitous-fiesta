'use strict';
require('dotenv').config();

/**
 * eval.js — Standalone evaluation script.
 * Run: node eval.js
 *
 * Computes top-1 precision against data/eval.json.
 */

const path = require('path');
const fs = require('fs');
const { pool, query } = require('./src/data/db');
const { rankImagesForPost } = require('./src/services/matchingService');
const { mismatchGuard } = require('./src/services/guardService');

async function runEval() {
  const evalPath = path.join(__dirname, 'data', 'eval.json');
  if (!fs.existsSync(evalPath)) {
    console.error('[eval] data/eval.json not found.');
    process.exit(1);
  }

  const evalSet = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
  console.log(`[eval] Running evaluation on ${evalSet.length} items...\n`);

  const results = [];
  let hits = 0;

  for (const item of evalSet) {
    const { post_id, correct_image_filename } = item;

    const { rows: postRows } = await query('SELECT * FROM posts WHERE id = $1', [post_id]);
    if (postRows.length === 0) {
      console.warn(`[eval] Post ${post_id} not found, skipping.`);
      results.push({ post_id, error: 'Post not found', top1_correct: false });
      continue;
    }
    const post = postRows[0];

    let ranked;
    try {
      ranked = await rankImagesForPost(post_id, 5);
    } catch (err) {
      console.warn(`[eval] Could not rank post ${post_id}: ${err.message}`);
      results.push({ post_id, error: err.message, top1_correct: false });
      continue;
    }

    if (ranked.length === 0) {
      results.push({ post_id, title: post.title, error: 'No embeddings', top1_correct: false });
      continue;
    }

    const { imageId: top1Id, score: top1Score } = ranked[0];
    const { rows: imgRows } = await query(`
      SELECT i.filename, it.subject, it.category, it.confidence
      FROM images i
      LEFT JOIN image_tags it ON it.image_id = i.id
      WHERE i.id = $1
    `, [top1Id]);

    const topImage = imgRows[0];
    const top1Correct = topImage?.filename === correct_image_filename;
    if (top1Correct) hits++;

    const guard = mismatchGuard(post, {
      subject:    topImage?.subject    || '',
      category:   topImage?.category   || 'other',
      confidence: topImage?.confidence || 0,
      attributes: [],
      caption: '',
    }, top1Score);

    const mark = top1Correct ? '✅' : '❌';
    console.log(`${mark} Post ${post_id} "${post.title.slice(0, 40)}"`);
    console.log(`   Expected : ${correct_image_filename}`);
    console.log(`   Got      : ${topImage?.filename || 'none'} (score=${top1Score.toFixed(4)})`);
    console.log(`   Guard    : ${guard.passed ? 'PASS' : 'FAIL'} — ${guard.reason}`);
    console.log();

    results.push({
      post_id,
      title: post.title,
      correct_image_filename,
      top1_image_filename: topImage?.filename,
      top1_score: top1Score,
      top1_correct,
      guard_passed: guard.passed,
      guard_reason: guard.reason,
    });
  }

  const precision = evalSet.length > 0 ? hits / evalSet.length : 0;
  console.log('─'.repeat(60));
  console.log(`Top-1 Precision: ${(precision * 100).toFixed(1)}%  (${hits}/${evalSet.length})`);
  console.log('─'.repeat(60));

  return { precision, hits, total: evalSet.length, results };
}

runEval()
  .catch(err => {
    console.error('[eval] Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
