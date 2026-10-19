# BUILDLOG.md — AI Usage Log

> Document every AI-assisted step taken to build this project.

## Project: FlyRank AI Image Matching Engine

---

## Session 1 — Initial Build

**Date:** 2026-10-19  
**AI Tool:** Gemini / Claude Sonnet / Claude Opus

### Prompts Used

| # | Prompt Summary | Files Generated | Notes |
|---|---------------|-----------------|-------|
| 1 | Generate complete Node.js Express backend with BullMQ, pgvector, Gemini vision + embeddings | All 33 project files | Initial capstone scaffold matching Section 6 specification |

### Decisions Made by AI

- Embeddings stored as `float4[]` in PostgreSQL rather than native pgvector `vector()` type — enables cosine computation in JS without strict dimension constraints at table creation.
- Mismatch guard uses keyword list for animal detection (`fox`, `wolf`, `dog`, `bear`, `deer`) — deterministic and fast vs. secondary LLM call.
- BullMQ queue with Redis for asynchronous background image ingestion.

---

## Session 2 — Debugging & Hardening

**Date:** 2026-10-19

### Issues Encountered & Resolutions

| Issue | Root Cause | Resolution |
|-------|------------|------------|
| `models/text-embedding-004 is not found for API version v1beta` | `text-embedding-004` is deprecated/unavailable on newer v1beta endpoint | Queried `ModelService.ListModels` to find supported embedding models. Switched to `gemini-embedding-001` (3072 dimensions, fully supported for `SEMANTIC_SIMILARITY`). |
| `gemini-1.5-flash:generateContent: 404 Not Found` | `gemini-1.5-flash` endpoint retired on this API version | Tested available models (`gemini-3.8-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`). Selected `gemini-3.5-flash-lite` for optimal free-tier availability, rapid response, and high accuracy. |
| `429 Too Many Requests: Quota exceeded limit: 5 RPM` | Free tier limits requests to 5 RPM; initial concurrency of 3 burst through the window | 1. Lowered BullMQ worker concurrency to 1.<br>2. Set BullMQ limiter to 4 req/min.<br>3. Added 13-second spacing between jobs.<br>4. Enhanced `visionService.js` retry handler to detect 429 and wait 35s before retrying. |
| Zod validation failed due to model returning JSON array `[{ ... }]` | Structured output can occasionally return a single-element array | Added unwrapping logic: `if (Array.isArray(parsed) && parsed.length > 0) parsed = parsed[0]` before `TagSchema.safeParse()`. |
| Variable reference error in `eval.js` (`top1_correct` vs `top1Correct`) | JavaScript variable typo | Fixed variable reference to `top1_correct: top1Correct`. |
| Unsplash URLs 404 for two image links | Temporary/expired Unsplash image URLs for wolf images | Replaced with verified, stable direct Unsplash photo URLs. |

---

## Reflection

**What worked well with AI assistance:**
- Fast scaffolding of layered architecture: separated data models, BullMQ jobs, Express routing, and services.
- Clean Zod schema validation ensuring invalid JSON is never persisted to database.
- Effective mismatch guard preventing subtle animal mismatches (e.g. wolf on fox article).

**What required manual correction:**
- API version differences in Google Generative AI SDK (model naming: `text-embedding-004` -> `gemini-embedding-001`, `gemini-1.5-flash` -> `gemini-3.5-flash-lite`).
- Strict free-tier rate limit handling (5 RPM throttling).

**Estimated AI vs. human effort ratio:**
- Scaffolding & Architecture: 90% AI / 10% Human
- Debugging & Model Tuning: 60% AI / 40% Human
- Overall: ~80% AI / 20% Human
