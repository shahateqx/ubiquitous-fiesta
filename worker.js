'use strict';
require('dotenv').config();

const { imageWorker } = require('./src/jobs/imageWorker');

console.log('[worker] BullMQ image processing worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[worker] SIGTERM received, closing worker...');
  await imageWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[worker] SIGINT received, closing worker...');
  await imageWorker.close();
  process.exit(0);
});
