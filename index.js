'use strict';
require('dotenv').config();

const express = require('express');
const app = express();

app.use(express.json());

// Routes
app.use('/images', require('./src/routes/images'));
app.use('/posts', require('./src/routes/posts'));
app.use('/suggestions', require('./src/routes/suggestions'));
app.use('/eval', require('./src/routes/eval'));
app.use('/cost', require('./src/routes/cost'));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Global error handler
app.use(require('./src/middleware/errorHandler'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[app] FlyRank Image Matching Engine listening on port ${PORT}`);
});

module.exports = app;
