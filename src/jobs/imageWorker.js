'use strict';
const { Worker } = require('bullmq');
const { processImage } = require('../services/visionService');
const { embedImageCaption } = require('../services/embeddingService');
const { connection, IMAGE_QUEUE_NAME } = require('./imageQueue');

/**
 * BullMQ worker that:
 *  1. Calls Gemini Vision to classify an image
 *  2. Embeds the resulting caption
 *  Both steps are logged to cost_log automatically by the services.
 */
const imageWorker = new Worker(
  IMAGE_QUEUE_NAME,
  async (job) => {
    const { imageId, imageUrl } = job.data;
    console.log(`[imageWorker] Processing job ${job.id} — image ${imageId} (${imageUrl})`);

    // Step 1: Classify image with Gemini Vision
    const { tag, status } = await processImage(imageId, imageUrl);
    console.log(`[imageWorker] Image ${imageId} classified: ${status} (confidence=${tag.confidence})`);

    // Step 2: Only embed if successfully tagged (not flagged)
    if (status === 'tagged') {
      await embedImageCaption(imageId, tag.caption);
      console.log(`[imageWorker] Image ${imageId} embedded.`);
    } else {
      console.warn(`[imageWorker] Image ${imageId} flagged — skipping embedding.`);
    }

    // Space out calls to stay strictly within 5 req/min free tier limit
    await new Promise(r => setTimeout(r, 13000));

    return { imageId, status, subject: tag.subject };
  },
  {
    connection,
    concurrency: 1,              // Process sequentially to prevent quota spikes
    limiter: {
      max: 4,
      duration: 60_000,          // 4 calls per minute (safely below 5/min limit)
    },
  }
);

imageWorker.on('completed', (job, result) => {
  console.log(`[imageWorker] Job ${job.id} completed:`, result);
});

imageWorker.on('failed', (job, err) => {
  console.error(`[imageWorker] Job ${job?.id} failed:`, err.message);
});

imageWorker.on('error', (err) => {
  console.error('[imageWorker] Worker error:', err.message);
});

module.exports = { imageWorker };
