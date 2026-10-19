'use strict';
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { z } = require('zod');
const { query } = require('../data/db');
const { logCost } = require('../utils/costTracker');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const VISION_MODEL = 'gemini-3.5-flash-lite';
const MAX_RETRIES = 3;

// ── Zod schema for structured vision output ──────────────────────────────────
const TagSchema = z.object({
  subject:    z.string(),
  category:   z.enum(['animal', 'plant', 'landscape', 'person', 'object', 'other']),
  attributes: z.array(z.string()),
  caption:    z.string(),
  confidence: z.number().min(0).max(1),
});

/**
 * Download an image from a URL and return base64-encoded bytes.
 * @param {string} url
 * @returns {Promise<{data: string, mimeType: string}>}
 */
async function fetchImageAsBase64(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
  const mimeType = response.headers['content-type']?.split(';')[0] || 'image/jpeg';
  const data = Buffer.from(response.data).toString('base64');
  return { data, mimeType };
}

/**
 * Call Gemini Flash vision API and parse structured tag output.
 * Retries up to MAX_RETRIES times on failure.
 *
 * @param {string} imageUrl - Public URL or local file path (file://)
 * @returns {Promise<{tag: object, tokensUsed: number}>}
 */
async function classifyImage(imageUrl) {
  const model = genAI.getGenerativeModel({ model: VISION_MODEL });

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data, mimeType } = await fetchImageAsBase64(imageUrl);

      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data } },
            {
              text: `Analyze this image carefully and return a JSON object with EXACTLY these fields:
- subject: string (main subject of the image, e.g. "red fox", "mountain lake")
- category: one of exactly: animal, plant, landscape, person, object, other
- attributes: array of descriptive strings (color, texture, setting, mood)
- caption: string (a single descriptive sentence for the image)
- confidence: float between 0 and 1 (your confidence in this classification)

Return ONLY valid JSON, no markdown, no extra text.`
            }
          ]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
        }
      });

      const tokensUsed = result.response?.usageMetadata?.totalTokenCount || 0;
      const rawText = result.response.text();

      let parsed;
      try {
        parsed = JSON.parse(rawText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed = parsed[0];
        }
      } catch {
        throw new Error(`Invalid JSON from vision model: ${rawText.slice(0, 200)}`);
      }

      const validation = TagSchema.safeParse(parsed);
      if (!validation.success) {
        throw new Error(`Zod validation failed: ${JSON.stringify(validation.error.issues)}`);
      }

      return { tag: validation.data, tokensUsed, rawResponse: parsed };
    } catch (err) {
      lastError = err;
      console.warn(`[visionService] Attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        let waitMs = 2000 * attempt;
        if (err.message && (err.message.includes('429') || err.message.includes('Quota exceeded'))) {
          waitMs = 35000; // wait 35s when quota exceeded
          console.log(`[visionService] Rate limit hit — waiting ${waitMs / 1000}s before retry...`);
        }
        await new Promise(r => setTimeout(r, waitMs));
      }
    }
  }

  throw lastError;
}

/**
 * Process a single image: call vision API, persist tags, update status.
 *
 * @param {number} imageId
 * @param {string} imageUrl
 * @returns {Promise<{tag: object, status: 'tagged'|'flagged'}>}
 */
async function processImage(imageId, imageUrl) {
  const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.5');

  let tag, tokensUsed, rawResponse;
  let status = 'tagged';

  try {
    ({ tag, tokensUsed, rawResponse } = await classifyImage(imageUrl));

    if (tag.confidence < CONFIDENCE_THRESHOLD) {
      status = 'flagged';
    }
  } catch (err) {
    // Vision failed entirely → flag the image
    console.error(`[visionService] Vision failed for image ${imageId}:`, err.message);
    status = 'flagged';

    // Insert a minimal placeholder tag so the row exists
    tag = {
      subject: 'unknown',
      category: 'other',
      attributes: [],
      caption: 'Classification failed',
      confidence: 0,
    };
    tokensUsed = 0;
    rawResponse = { error: err.message };
  }

  // Persist tag
  await query(
    `INSERT INTO image_tags (image_id, subject, category, attributes, caption, confidence, raw_response)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      imageId,
      tag.subject,
      tag.category,
      JSON.stringify(tag.attributes),
      tag.caption,
      tag.confidence,
      JSON.stringify(rawResponse),
    ]
  );

  // Update image status
  await query('UPDATE images SET status = $1 WHERE id = $2', [status, imageId]);

  // Log cost
  await logCost({
    callType: 'vision',
    model: VISION_MODEL,
    tokensUsed,
    estimatedCost: 0, // Gemini Flash is on free tier
    relatedId: imageId,
  });

  return { tag, status };
}

module.exports = { processImage, classifyImage, TagSchema };
