'use strict';

/**
 * Zod request body validation middleware factory.
 *
 * Usage: router.post('/path', validate(MyZodSchema), handler)
 *
 * @param {import('zod').ZodSchema} schema
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        issues: result.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    // Replace req.body with parsed + coerced data
    req.body = result.data;
    next();
  };
}

module.exports = validate;
