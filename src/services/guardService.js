'use strict';

const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.65');
const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.5');

// Animal keywords used for category mismatch detection
const ANIMAL_KEYWORDS = ['fox', 'wolf', 'dog', 'bear', 'deer', 'cat', 'bird'];

/**
 * Mismatch guard: evaluates whether an image is a good match for a post.
 *
 * @param {object} post        - { id, title, content }
 * @param {object} imageTag    - { subject, category, attributes, caption, confidence }
 * @param {number} similarityScore - Cosine similarity score [0, 1]
 * @returns {{ passed: boolean, reason: string }}
 */
function mismatchGuard(post, imageTag, similarityScore) {
  // 1. Similarity threshold check
  if (similarityScore < SIMILARITY_THRESHOLD) {
    return {
      passed: false,
      reason: `Similarity ${similarityScore.toFixed(3)} is below threshold ${SIMILARITY_THRESHOLD}`,
    };
  }

  // 2. Confidence check
  if (imageTag.confidence < CONFIDENCE_THRESHOLD) {
    return {
      passed: false,
      reason: `Low image classification confidence: ${imageTag.confidence.toFixed(2)} (threshold: ${CONFIDENCE_THRESHOLD})`,
    };
  }

  // 3. Animal category cross-mismatch
  const postText = `${post.title} ${post.content}`.toLowerCase();

  const detectedAnimal = ANIMAL_KEYWORDS.find(k =>
    imageTag.subject.toLowerCase().includes(k)
  );
  const postMentionsAnimal = ANIMAL_KEYWORDS.find(k => postText.includes(k));

  if (detectedAnimal && postMentionsAnimal && detectedAnimal !== postMentionsAnimal) {
    return {
      passed: false,
      reason: `Animal mismatch: post mentions "${postMentionsAnimal}" but image shows "${detectedAnimal}"`,
    };
  }

  return { passed: true, reason: 'Match accepted' };
}

module.exports = { mismatchGuard, SIMILARITY_THRESHOLD, CONFIDENCE_THRESHOLD };
