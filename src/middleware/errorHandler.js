'use strict';

/**
 * Global Express error handler.
 * Returns clean JSON for all 4xx / 5xx errors.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (status >= 500) {
    console.error(`[errorHandler] ${req.method} ${req.path} → ${status}:`, err);
  } else {
    console.warn(`[errorHandler] ${req.method} ${req.path} → ${status}: ${message}`);
  }

  res.status(status).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
