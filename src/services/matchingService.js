'use strict';
const { query } = require('../data/db');
const { cosineSimilarity } = require('../utils/cosine');

/**
 * Retrieve the embedding vector for a post.
 * @param {number} postId
 * @returns {Promise<number[]|null>}
 */
async function getPostVector(postId) {
  const { rows } = await query(
    'SELECT embedding FROM post_vectors WHERE post_id = $1 LIMIT 1',
    [postId]
  );
  if (rows.length === 0) return null;
  return rows[0].embedding; // pg returns float4[] as JS number[]
}

/**
 * Retrieve all image vectors for images with status = 'tagged'.
 * @returns {Promise<Array<{imageId: number, embedding: number[]}>>}
 */
async function getAllImageVectors() {
  const { rows } = await query(`
    SELECT iv.image_id, iv.embedding
    FROM   image_vectors iv
    JOIN   images i ON i.id = iv.image_id
    WHERE  i.status = 'tagged'
  `);
  return rows.map(r => ({ imageId: r.image_id, embedding: r.embedding }));
}

/**
 * Rank all tagged images against a post vector using cosine similarity.
 *
 * @param {number[]} postVector
 * @param {Array<{imageId: number, embedding: number[]}>} imageVectors
 * @param {number} [topN=5]
 * @returns {Array<{imageId: number, score: number}>}
 */
function rankImages(postVector, imageVectors, topN = 5) {
  const scored = imageVectors.map(iv => ({
    imageId: iv.imageId,
    score: cosineSimilarity(postVector, iv.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

/**
 * Full matching pipeline for a given post.
 * Returns top-N ranked image IDs with scores.
 *
 * @param {number} postId
 * @param {number} [topN=5]
 * @returns {Promise<Array<{imageId: number, score: number}>>}
 */
async function rankImagesForPost(postId, topN = 5) {
  const postVector = await getPostVector(postId);
  if (!postVector) {
    throw new Error(`No embedding found for post ${postId}. Run the embedding job first.`);
  }

  const imageVectors = await getAllImageVectors();
  if (imageVectors.length === 0) {
    return [];
  }

  return rankImages(postVector, imageVectors, topN);
}

module.exports = { rankImagesForPost, getPostVector, getAllImageVectors, rankImages };
