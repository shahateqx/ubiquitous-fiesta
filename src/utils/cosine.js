'use strict';

/**
 * Compute cosine similarity between two float arrays.
 * Returns a value in [-1, 1]. Higher = more similar.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a?.length} vs ${b?.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;

  return dot / (normA * normB);
}

module.exports = { cosineSimilarity };
