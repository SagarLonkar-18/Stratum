-- Enable pgvector extension (safe to run even if already enabled elsewhere)
CREATE EXTENSION IF NOT EXISTS vector;

-- nomic-embed-text produces 768-dimensional embeddings
ALTER TABLE "Chunk" ADD COLUMN embedding vector(768);

-- HNSW index for fast approximate nearest-neighbor search using cosine
-- distance — the standard similarity metric for text embeddings.
CREATE INDEX chunk_embedding_hnsw_idx
  ON "Chunk" USING hnsw (embedding vector_cosine_ops);