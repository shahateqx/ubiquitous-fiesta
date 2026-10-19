# BUILDLOG.md — AI Usage Log

> Document every AI-assisted step taken to build this project.

## Project: FlyRank AI Image Matching Engine

---

## Session 1 — Initial Build

**Date:** ___________
**AI Tool:** Gemini / Claude / GPT-4 (specify)

### Prompts Used

| # | Prompt Summary | Files Generated | Notes |
|---|---------------|-----------------|-------|
| 1 | Generate complete Node.js Express backend with BullMQ, pgvector, Gemini vision + embeddings | All project files | Full capstone scaffold |
| 2 | | | |
| 3 | | | |

### Decisions Made by AI

- Embeddings stored as `float4[]` in PostgreSQL rather than native pgvector `vector()` type — enables cosine computation in JS without pgvector operators
- Mismatch guard uses keyword list for animal detection — simpler and deterministic vs. another LLM call
- Vision retries use exponential backoff (1s, 2s, 3s) capped at 3 attempts
- BullMQ concurrency set to 3 with rate limiter of 10 calls/minute for Gemini API safety

### Manual Edits Made (after AI generation)

- [ ] None yet
- [ ] ___________

---

## Session 2 — Debugging / Iteration

**Date:** ___________

### Issues Encountered

| Issue | AI Prompt Used | Resolution |
|-------|----------------|------------|
| | | |

---

## Reflection

**What worked well with AI assistance:**

**What required manual correction:**

**Estimated AI vs. human effort ratio:**
