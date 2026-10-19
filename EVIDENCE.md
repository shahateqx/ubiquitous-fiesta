# EVIDENCE.md — FlyRank AI Image Matching Engine

> Capstone submission checklist. Verified outputs and evidence from running the system.

## Core Pipeline

- [x] **Vision classification** — Images are classified by Gemini Flash Lite with `subject`, `category`, `attributes`, `caption`, `confidence`
- [x] **Zod schema validation** — Vision output validated against `TagSchema`; failures set image to `flagged`
- [x] **Retry logic** — Vision calls retry up to 3 times with exponential backoff and rate-limit wait
- [x] **Embeddings** — Image captions embedded via `gemini-embedding-001` (3072 dimensions) and stored as `float4[]`
- [x] **Post embeddings** — Blog post text (title + content) embedded on creation
- [x] **Cosine similarity** — Ranking computed in pure JS using `src/utils/cosine.js`

## Mismatch Guard

- [x] **Similarity threshold** — Matches below 0.65 are rejected with reason
- [x] **Confidence threshold** — Images with confidence < 0.5 are rejected
- [x] **Animal cross-check** — Detects fox/wolf/dog/bear/deer mismatches between post and image

### Mismatch Guard Verification Output
```
Fox post with Wolf image:
{
  passed: false,
  reason: 'Animal mismatch: post mentions "fox" but image shows "wolf"'
}

Fox post with Fox image:
{ passed: true, reason: 'Match accepted' }

Fox post with low similarity (0.40):
{ passed: false, reason: 'Similarity 0.400 is below threshold 0.65' }
```

## API Endpoints

- [x] `POST /images` — Returns 201 with image + queued job
- [x] `GET /images` — Returns all images with tag arrays
- [x] `GET /images/:id` — Returns single image with full tags
- [x] `POST /images/batch` — Queues all pending images for processing
- [x] `POST /posts` — Creates post and embeds immediately
- [x] `GET /posts` — Returns all posts
- [x] `GET /posts/:id` — Returns single post
- [x] `GET /posts/:id/images` — Returns ranked suggestions with guard results
- [x] `GET /suggestions` — Lists suggestions (supports `?status=` filter)
- [x] `GET /suggestions/:id` — Full context for a suggestion
- [x] `POST /suggestions/:id/approve` — Sets status to `approved`
- [x] `POST /suggestions/:id/reject` — Sets status to `rejected` with reason
- [x] `POST /eval` — Runs evaluation and returns precision
- [x] `GET /eval/results` — Returns last eval result
- [x] `GET /cost` — Returns cost summary by call type

## Data & Infrastructure

- [x] **Database migrations** — `001_initial.sql` creates all 7 tables
- [x] **BullMQ queue** — Image processing jobs queued and consumed by worker
- [x] **Docker Compose** — All 4 services start with `docker compose up`
- [x] **Seed script** — `node seed.js` populates posts, images, triggers batch
- [x] **Eval script** — `node eval.js` outputs top-1 precision to console
- [x] **Cost logging** — Every vision/embedding call logged to `cost_log`
- [x] **`.env` secrets** — API key never hardcoded; `.env` in `.gitignore`

## Eval Results

| Run | Date | Top-1 Precision | Hits | Notes |
|-----|------|-----------------|------|-------|
| 1   | 2026-10-19 | **80.0%** | 8/10 | Evaluation against 10 labeled post-image pairs |

```
[eval] Running evaluation on 10 items...

✅ Post 1 "The Behavior of Red Foxes"
   Expected : red-fox-1.jpg,red-fox-2.jpg
   Got      : red-fox-2.jpg (score=0.8362)
   Guard    : PASS — Match accepted

✅ Post 2 "Gray Wolves in the Wild"
   Expected : gray-wolf-1.jpg,gray-wolf-2.jpg,wolf-pack-1.jpg
   Got      : wolf-pack-1.jpg (score=0.7780)
   Guard    : PASS — Match accepted

✅ Post 3 "Domestic Dogs and Human Bonding"
   Expected : dog-1.jpg,dog-2.jpg
   Got      : dog-1.jpg (score=0.7716)
   Guard    : PASS — Match accepted

✅ Post 4 "Brown Bears of Yellowstone"
   Expected : brown-bear-1.jpg
   Got      : brown-bear-1.jpg (score=0.8047)
   Guard    : PASS — Match accepted

✅ Post 5 "White-Tailed Deer Migration"
   Expected : deer-1.jpg
   Got      : deer-1.jpg (score=0.8128)
   Guard    : PASS — Match accepted

❌ Post 6 "Autumn Forest Landscapes"
   Expected : forest-autumn-1.jpg
   Got      : mountain-lake-1.jpg (score=0.7874)
   Guard    : PASS — Match accepted

✅ Post 7 "Mountain Lake Reflections"
   Expected : mountain-lake-1.jpg
   Got      : mountain-lake-1.jpg (score=0.8189)
   Guard    : PASS — Match accepted

✅ Post 8 "Urban Street Photography"
   Expected : street-city-1.jpg
   Got      : street-city-1.jpg (score=0.7791)
   Guard    : PASS — Match accepted

✅ Post 9 "Tropical Bird Species"
   Expected : parrot-1.jpg
   Got      : parrot-1.jpg (score=0.7957)
   Guard    : PASS — Match accepted

❌ Post 10 "Desert Cactus Ecosystems"
   Expected : cactus-1.jpg
   Got      : parrot-1.jpg (score=0.7627)
   Guard    : PASS — Match accepted

────────────────────────────────────────────────────────────
Top-1 Precision: 80.0%  (8/10)
────────────────────────────────────────────────────────────
```

## Sample API Responses

### GET /posts/1/images (Real Transcript)

```json
{
  "success": true,
  "post": {
    "id": 1,
    "title": "The Behavior of Red Foxes"
  },
  "totalCandidates": 5,
  "suggestions": [
    {
      "suggestionId": 1,
      "imageId": 2,
      "filename": "red-fox-2.jpg",
      "url": "https://images.unsplash.com/photo-1516934024742-b461fba47600?w=800",
      "subject": "red fox",
      "category": "animal",
      "caption": "A close-up portrait of a curious red fox looking directly at the camera in a forest setting.",
      "confidence": 0.99,
      "similarityScore": 0.8362,
      "guardPassed": true,
      "guardReason": "Match accepted"
    },
    {
      "suggestionId": 2,
      "imageId": 1,
      "filename": "red-fox-1.jpg",
      "url": "https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=800",
      "subject": "red fox",
      "category": "animal",
      "caption": "A red fox stands alert on a snowy ridge, illuminated by the warm glow of late afternoon sun.",
      "confidence": 1,
      "similarityScore": 0.828,
      "guardPassed": true,
      "guardReason": "Match accepted"
    }
  ]
}
```

### POST /suggestions/1/approve
```json
{
  "success": true,
  "suggestion": {
    "id": 1,
    "post_id": 1,
    "image_id": 2,
    "similarity_score": 0.8361855927258793,
    "guard_passed": true,
    "guard_reason": "Match accepted",
    "status": "approved"
  }
}
```

### POST /suggestions/3/reject
```json
{
  "success": true,
  "suggestion": {
    "id": 3,
    "post_id": 1,
    "image_id": 14,
    "similarity_score": 0.7811688744007953,
    "guard_passed": true,
    "guard_reason": "Irrelevant subject",
    "status": "rejected"
  }
}
```

### GET /cost Summary
```json
{
  "success": true,
  "summary": {
    "by_type": [
      {
        "call_type": "vision",
        "total_calls": "18",
        "total_tokens": "13500",
        "total_cost": 0
      },
      {
        "call_type": "embedding",
        "total_calls": "25",
        "total_tokens": "850",
        "total_cost": 0
      }
    ],
    "total_calls": "43",
    "total_estimated_cost": 0
  }
}
```
