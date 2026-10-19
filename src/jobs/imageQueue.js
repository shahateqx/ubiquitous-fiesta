'use strict';
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const IMAGE_QUEUE_NAME = 'image-processing';

const imageQueue = new Queue(IMAGE_QUEUE_NAME, { connection });

/**
 * Add a single image processing job to the queue.
 *
 * @param {object} data - { imageId, imageUrl }
 * @param {object} [opts] - BullMQ job options
 */
async function addImageJob(data, opts = {}) {
  const job = await imageQueue.add('process-image', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    ...opts,
  });
  return job;
}

/**
 * Add multiple image jobs in a batch.
 *
 * @param {Array<{imageId: number, imageUrl: string}>} images
 */
async function addBatchImageJobs(images) {
  const jobs = images.map(img => ({
    name: 'process-image',
    data: img,
    opts: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    },
  }));
  return imageQueue.addBulk(jobs);
}

module.exports = { imageQueue, addImageJob, addBatchImageJobs, IMAGE_QUEUE_NAME, connection };
