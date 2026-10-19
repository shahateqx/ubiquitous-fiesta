'use strict';
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { query } = require('../data/db');
const { logCost } = require('../utils/costTracker');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const EMBEDDING_MODEL = 'text-embedding-004';

/**
 * Generate a text embedding using Gemini text-embedding-004.
 *
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - Float array embedding
 */
async function generateEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  const result = await model.embedContent({
    content: { parts: [{ text }], role: 'user' },
    taskType: 'SEMANTIC_SIMILARITY',
  });

  const embedding = result.embedding.values;
  if (!embedding || embedding.length === 0) {
    throw new Error('Empty embedding returned from Gemini');
  }

  return embedding;
}

/**
 * Embed an image caption and store in image_vectors.
 *
 * @param {number} imageId
 * @param {string} caption
 * @returns {Promise<number[]>}
 */
async function embedImageCaption(imageId, caption) {
  const embedding = await generateEmbedding(caption);

  // Remove old vector if exists (re-embed scenario)
  await query('DELETE FROM image_vectors WHERE image_id = $1', [imageId]);

  // Store as float4[] literal
  const arrayLiteral = `{${embedding.join(',')}}`;
  await query(
    'INSERT INTO image_vectors (image_id, embedding) VALUES ($1, $2)',
    [imageId, arrayLiteral]
  );

  // Log cost (embedding tokens ~ text length / 4 as rough estimate)
  await logCost({
    callType: 'embedding',
    model: EMBEDDING_MODEL,
    tokensUsed: Math.ceil(caption.length / 4),
    estimatedCost: 0,
    relatedId: imageId,
  });

  return embedding;
}

/**
 * Embed a blog post (title + content) and store in post_vectors.
 *
 * @param {number} postId
 * @param {string} title
 * @param {string} content
 * @returns {Promise<number[]>}
 */
async function embedPost(postId, title, content) {
  const text = `${title}\n\n${content}`;
  const embedding = await generateEmbedding(text);

  // Remove old vector if exists
  await query('DELETE FROM post_vectors WHERE post_id = $1', [postId]);

  const arrayLiteral = `{${embedding.join(',')}}`;
  await query(
    'INSERT INTO post_vectors (post_id, embedding) VALUES ($1, $2)',
    [postId, arrayLiteral]
  );

  await logCost({
    callType: 'embedding',
    model: EMBEDDING_MODEL,
    tokensUsed: Math.ceil(text.length / 4),
    estimatedCost: 0,
    relatedId: postId,
  });

  return embedding;
}

module.exports = { generateEmbedding, embedImageCaption, embedPost };
