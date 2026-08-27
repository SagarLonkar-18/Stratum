-- Generated column: automatically derived from `content`, kept in sync by
-- Postgres itself whenever `content` changes — no application code needs
-- to remember to update this separately.
ALTER TABLE "Chunk" ADD COLUMN content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- GIN index: the standard index type for full-text search columns,
-- optimized for "does this row's tsvector contain these search terms."
CREATE INDEX chunk_content_tsv_gin_idx
  ON "Chunk" USING GIN (content_tsv);