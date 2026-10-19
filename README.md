# FlyRank AI Image Matching Engine

A production-quality Node.js backend service that automatically classifies images using Gemini Vision, embeds captions and blog post text, and ranks images for each blog post using cosine similarity — protected by a mismatch guard.

## Architecture

```
Images --(BullMQ job)--> Gemini Vision --> {tags, caption, confidence} --> image_metadata
                              | embed(caption) --> image_vectors
Posts --> embed(post text) --> post_vectors

GET /posts/:id/images
    --> Cosine Similarity Ranking (image_vectors × post_vector)
          --> Mismatch Guard (similarity threshold + confidence + animal cross-check)
                | ✅ Suggested image (ranked, explained)
                | ❌ "No good match" + reason
                      --> Review API: approve / reject
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20 + Express |
| AI | Google Gemini Flash (vision) + text-embedding-004 |
| Schema validation | Zod |
| Database | PostgreSQL 16 with pgvector |
| Job queue | BullMQ + Redis |
| Containerization | Docker Compose |

## Project Structure

```
.
├── index.js              # Express app entry
├── worker.js             # BullMQ worker entry
├── seed.js               # DB seeding + batch trigger
├── eval.js               # Standalone evaluation script
├── data/
│   └── eval.json         # Labeled evaluation set
├── src/
│   ├── data/
│   │   ├── db.js         # PostgreSQL pool
│   │   ├── migrate.js    # Migration runner
│   │   └── migrations/
│   │       └── 001_initial.sql
│   ├── services/
│   │   ├── visionService.js    # Gemini Flash vision + Zod
│   │   ├── embeddingService.js # Gemini text-embedding-004
│   │   ├── matchingService.js  # Cosine similarity ranking
│   │   └── guardService.js     # Mismatch guard
│   ├── jobs/
│   │   ├── imageQueue.js  # BullMQ queue definition
│   │   └── imageWorker.js # BullMQ worker processor
│   ├── routes/
│   │   ├── images.js      # Image CRUD + batch
│   │   ├── posts.js       # Post CRUD + ranking
│   │   ├── suggestions.js # Review API
│   │   ├── eval.js        # Eval endpoints
│   │   └── cost.js        # Cost log
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   └── validate.js
│   └── utils/
│       ├── cosine.js      # Cosine similarity
│       └── costTracker.js # DB cost logging
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── capstone.yaml
```

## Setup

### Prerequisites
- Docker + Docker Compose
- Node.js 20+ (for local dev only)

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env and set your GEMINI_API_KEY
```

### 2. Start with Docker Compose

```bash
docker compose up --build
```

This starts:
- **postgres** on port 5432 (pgvector image)
- **redis** on port 6379
- **app** on port 3000 (Express API)
- **worker** (BullMQ processor)

### 3. Seed the database

```bash
docker compose exec app node seed.js
```

This will:
1. Run database migrations
2. Insert 10 sample blog posts and embed each one
3. Register 15 images from Unsplash
4. Queue all images for vision processing + embedding

### 4. Run evaluation

```bash
docker compose exec app node eval.js
```

Or via the API:
```bash
curl -X POST http://localhost:3000/eval
```

## API Reference

### Images

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/images` | Register a new image |
| `GET` | `/images` | List all images with tags |
| `GET` | `/images/:id` | Get single image with full tag details |
| `POST` | `/images/batch` | Trigger batch processing for pending images |

**Register image:**
```bash
curl -X POST http://localhost:3000/images \
  -H "Content-Type: application/json" \
  -d '{"filename": "my-image.jpg", "url": "https://example.com/image.jpg"}'
```

**Trigger batch:**
```bash
curl -X POST http://localhost:3000/images/batch
```

### Posts

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/posts` | Create a blog post (auto-embedded) |
| `GET` | `/posts` | List all posts |
| `GET` | `/posts/:id` | Get single post |
| `GET` | `/posts/:id/images` | Get ranked image suggestions |

**Get ranked images for a post:**
```bash
curl http://localhost:3000/posts/1/images
```

Response includes:
- `suggestions[]` — ranked images with similarity scores
- `guardPassed` — whether the mismatch guard approved each image
- `guardReason` — explanation of the guard decision

### Suggestions (Review API)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/suggestions` | List all suggestions (filter by `?status=pending`) |
| `GET` | `/suggestions/:id` | Inspect a suggestion with full context |
| `POST` | `/suggestions/:id/approve` | Approve a suggestion |
| `POST` | `/suggestions/:id/reject` | Reject with optional reason |

```bash
curl -X POST http://localhost:3000/suggestions/1/approve
curl -X POST http://localhost:3000/suggestions/1/reject \
  -H "Content-Type: application/json" \
  -d '{"reason": "Wrong animal species"}'
```

### Eval & Cost

```bash
curl -X POST http://localhost:3000/eval          # Run evaluation
curl http://localhost:3000/eval/results          # Latest results
curl http://localhost:3000/cost                  # Cost log summary
```

## Mismatch Guard Logic

The guard rejects matches that fail any of these checks:

1. **Similarity threshold** — score must be ≥ 0.65
2. **Confidence threshold** — image classification confidence must be ≥ 0.5
3. **Animal cross-mismatch** — if the post mentions "fox" but the image shows "wolf", it's rejected

```js
mismatchGuard(post, imageTag, similarityScore)
// Returns { passed: boolean, reason: string }
```

## Cost Tracking

Every Gemini API call is logged to `cost_log` with:
- `call_type`: `vision` or `embedding`
- `model`: model name used
- `tokens_used`: from API response metadata
- `estimated_cost`: currently `0` (Gemini free tier)

View costs: `GET /cost`

## Database Schema

```sql
images         -- filename, url, status (pending/tagged/flagged)
image_tags     -- subject, category, attributes[], caption, confidence
image_vectors  -- embedding float4[]
posts          -- title, content
post_vectors   -- embedding float4[]
suggestions    -- similarity_score, guard_passed, guard_reason, status
cost_log       -- call_type, model, tokens_used, estimated_cost
```

## Limitations

- Embedding dimension is 768 (Gemini text-embedding-004). The mismatch guard uses keyword-based animal detection rather than semantic reasoning — a future improvement would use a Gemini call to compare semantics directly.
- Images are fetched from URLs at classification time; no local caching implemented.
- The eval top-1 precision depends heavily on the quality of Gemini's captions for the specific Unsplash images.
- Similarity scores are computed in JavaScript (not using pgvector's `<=>` operator) for portability.
