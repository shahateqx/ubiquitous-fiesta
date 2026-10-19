-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. images
CREATE TABLE IF NOT EXISTS images (
  id         SERIAL PRIMARY KEY,
  filename   TEXT NOT NULL,
  url        TEXT,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'tagged', 'flagged')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. image_tags
CREATE TABLE IF NOT EXISTS image_tags (
  id           SERIAL PRIMARY KEY,
  image_id     INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  subject      TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('animal', 'plant', 'landscape', 'person', 'object', 'other')),
  attributes   JSONB NOT NULL DEFAULT '[]',
  caption      TEXT NOT NULL,
  confidence   FLOAT NOT NULL,
  raw_response JSONB,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- 3. image_vectors  (stored as float4[] so cosine is computed in JS)
CREATE TABLE IF NOT EXISTS image_vectors (
  id         SERIAL PRIMARY KEY,
  image_id   INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  embedding  float4[] NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. posts
CREATE TABLE IF NOT EXISTS posts (
  id         SERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. post_vectors
CREATE TABLE IF NOT EXISTS post_vectors (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  embedding  float4[] NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. suggestions
CREATE TABLE IF NOT EXISTS suggestions (
  id               SERIAL PRIMARY KEY,
  post_id          INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  image_id         INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  similarity_score FLOAT NOT NULL,
  guard_passed     BOOLEAN NOT NULL,
  guard_reason     TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at       TIMESTAMP DEFAULT NOW()
);

-- 7. cost_log
CREATE TABLE IF NOT EXISTS cost_log (
  id             SERIAL PRIMARY KEY,
  call_type      TEXT NOT NULL CHECK (call_type IN ('vision', 'embedding')),
  model          TEXT NOT NULL,
  tokens_used    INTEGER DEFAULT 0,
  estimated_cost FLOAT DEFAULT 0,
  related_id     INTEGER,
  created_at     TIMESTAMP DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_image_tags_image_id    ON image_tags(image_id);
CREATE INDEX IF NOT EXISTS idx_image_vectors_image_id ON image_vectors(image_id);
CREATE INDEX IF NOT EXISTS idx_post_vectors_post_id   ON post_vectors(post_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_post_id    ON suggestions(post_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status     ON suggestions(status);
CREATE INDEX IF NOT EXISTS idx_cost_log_call_type     ON cost_log(call_type);
