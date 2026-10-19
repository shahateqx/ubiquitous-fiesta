# EVIDENCE.md — FlyRank AI Image Matching Engine

> Capstone submission checklist. Check each box as you verify the feature works.

## Core Pipeline

- [ ] **Vision classification** — Images are classified by Gemini Flash with `subject`, `category`, `attributes`, `caption`, `confidence`
- [ ] **Zod schema validation** — Vision output validated against `TagSchema`; failures set image to `flagged`
- [ ] **Retry logic** — Vision calls retry up to 3 times with exponential backoff
- [ ] **Embeddings** — Image captions embedded via `text-embedding-004` and stored as `float4[]`
- [ ] **Post embeddings** — Blog post text (title + content) embedded on creation
- [ ] **Cosine similarity** — Ranking computed in pure JS using `src/utils/cosine.js`

## Mismatch Guard

- [ ] **Similarity threshold** — Matches below 0.65 are rejected with reason
- [ ] **Confidence threshold** — Images with confidence < 0.5 are rejected
- [ ] **Animal cross-check** — Detects fox/wolf/dog/bear/deer mismatches between post and image

## API Endpoints

- [ ] `POST /images` — Returns 201 with image + queued job
- [ ] `GET /images` — Returns all images with tag arrays
- [ ] `GET /images/:id` — Returns single image with full tags
- [ ] `POST /images/batch` — Queues all pending images for processing
- [ ] `POST /posts` — Creates post and embeds immediately
- [ ] `GET /posts` — Returns all posts
- [ ] `GET /posts/:id` — Returns single post
- [ ] `GET /posts/:id/images` — Returns ranked suggestions with guard results
- [ ] `GET /suggestions` — Lists suggestions (supports `?status=` filter)
- [ ] `GET /suggestions/:id` — Full context for a suggestion
- [ ] `POST /suggestions/:id/approve` — Sets status to `approved`
- [ ] `POST /suggestions/:id/reject` — Sets status to `rejected` with reason
- [ ] `POST /eval` — Runs evaluation and returns precision
- [ ] `GET /eval/results` — Returns last eval result
- [ ] `GET /cost` — Returns cost summary by call type

## Data & Infrastructure

- [ ] **Database migrations** — `001_initial.sql` creates all 7 tables
- [ ] **BullMQ queue** — Image processing jobs queued and consumed by worker
- [ ] **Docker Compose** — All 4 services start with `docker compose up`
- [ ] **Seed script** — `node seed.js` populates posts, images, triggers batch
- [ ] **Eval script** — `node eval.js` outputs top-1 precision to console
- [ ] **Cost logging** — Every vision/embedding call logged to `cost_log`
- [ ] **`.env` secrets** — API key never hardcoded; `.env` in `.gitignore`

## Eval Results

| Run | Date | Top-1 Precision | Notes |
|-----|------|-----------------|-------|
| 1   |      |                 |       |
| 2   |      |                 |       |

## Sample API Responses

### GET /posts/1/images (paste real response here)

```json
```

### GET /cost (paste real response here)

```json
```
