# Stratum

A locally-run, multi-tenant RAG knowledge base with hybrid search and reranking - built for organizations that can't send their documents to a cloud LLM API.

---

## Status

Core pipeline is complete and manually verified end-to-end: upload → extract → dual-strategy chunking → embed → hybrid search → rerank → cited generation. The evaluation harness mechanism is built and correct (see [Evaluation](#evaluation) below for what that actually means right now); a frontend and CSV support are deliberately not built yet - see [What's not here yet](#whats-not-here-yet).

---

## Why this project

Most "chat with your PDF" projects call an embedding API, drop vectors into a vector store, and call it done. That's a fine afternoon project, but it skips every interesting problem: how do you actually know your retrieval is working? Does your chunking strategy matter, or is it cargo-culted from a tutorial? What happens when two different customers' documents live in the same database - does your isolation hold up if someone forgets a `WHERE` clause, or does it just rely on nobody making a mistake?

Stratum exists to answer those questions properly, for a specific, real constraint: some organizations - healthcare, legal, defense, anyone with a data-residency requirement - genuinely cannot send their documents to OpenAI or Anthropic's servers. So this runs fully local: local embeddings, local generation, local reranking, no API key required, no data leaving the machine.

The interesting engineering here is structural multi-tenant isolation enforced by the database itself (not application code), a measured comparison between two chunking strategies instead of picking one on faith, hybrid retrieval that combines semantic and lexical search because each one fails differently, and a reranking step whose actual before/after effect is visible in the scores, not just claimed.

---

## Features

- **Multi-tenant workspaces** - each user's workspaces are isolated from every other user's, enforced at the database layer via Postgres Row-Level Security, not just an app-layer filter.
- **Multi-file ingestion** - PDF upload, text extraction, and automatic chunking on upload.
- **Two chunking strategies, stored side by side** - a naive fixed-size sliding window and a structure-aware chunker that respects paragraph and sentence boundaries. Both run on every upload so they can be directly compared.
- **Hybrid search** - vector similarity (pgvector, cosine distance) and Postgres full-text search, combined via Reciprocal Rank Fusion, because they fail in different places and neither alone is enough.
- **Cross-encoder reranking** - a standalone FastAPI service re-scores the top candidates with a real cross-encoder model before they reach the LLM.
- **Grounded, cited answers** - the LLM answers only from retrieved chunks, cites which chunk each claim came from, and is explicitly instructed to say "I don't know" rather than fill gaps - verified against real miscitation failures, not just assumed to work.
- **Fully local inference** - Ollama running natively on the host (not in Docker, since Docker Desktop on Mac has no GPU passthrough) for both embeddings and generation. No API key, no per-request cost, no data leaving the machine.

---

## Architecture

![Stratum system architecture](./docs/architecture-diagram.svg)

**Backend** - Node.js + Express + TypeScript, containerized with Docker.

**Database** - PostgreSQL with the `pgvector` extension, via Prisma. Two things Prisma can't express natively - the `vector` column and the full-text `tsvector` generated column - are added via raw SQL migrations and marked `Unsupported()` in the schema so Prisma knows they exist and won't silently drop them on a future auto-migration.

**Tenant isolation** - every `Chunk`/`Document` query runs inside a transaction that first sets `app.workspace_id` via `SET LOCAL`, then Postgres Row-Level Security policies filter every subsequent query to that workspace automatically - including queries that forget a `WHERE` clause entirely. If the scope is never set, the policy evaluates to unknown and returns zero rows, not all rows: it fails closed.

**LLM + embeddings** - Ollama, running natively on the host. `nomic-embed-text` for embeddings (768-dim), `qwen2.5:7b-instruct`, 4-bit quantized, for generation. The backend reaches it via `host.docker.internal` since the container can't see `localhost` on the host directly.

**Reranker** - a separate Python/FastAPI service running `cross-encoder/ms-marco-MiniLM-L-6-v2` via `sentence-transformers`, CPU-only (the default install pulls GPU/CUDA wheels that are useless in a Docker container with no GPU passthrough - pinning the CPU-only PyTorch build cut the image download from several GB to under 300MB).

**File storage** - uploaded PDFs are saved to disk, namespaced by workspace (`uploads/<workspaceId>/<documentId>-<filename>`), inside a Docker-mounted volume. Not object storage - deliberately out of scope, see below.

---

## Key engineering decisions

### Tenant isolation as a structural guarantee, not a convention

`workspaceId` is denormalized directly onto `Chunk`, not only reachable via a join through `Document` - this keeps the RLS policy a single-column check and lets a `(workspaceId, embedding)` index be used directly by vector search instead of requiring a join at query time. Every request that touches `Chunk`/`Document` goes through a `withWorkspace(workspaceId, fn)` wrapper that opens a transaction, sets the RLS scope, and only then runs the query - so there is no code path where a query can run unscoped and still return real data.

This was tested, not assumed: an automated test seeds two workspaces, then deliberately runs a query with no `WHERE` clause at all, scoped only via the transaction context, and asserts it returns exactly the calling workspace's data. That test caught a real bug during development - the database's default `POSTGRES_USER` in the official Docker image is a **superuser**, and Postgres superusers bypass Row-Level Security unconditionally, even with `FORCE ROW LEVEL SECURITY` set. The application now connects as a separate, deliberately non-superuser role (`CREATEDB` only, no `SUPERUSER`) specifically so RLS actually applies to it. Schema migrations still require the superuser role, since altering tables needs owner privileges the restricted role intentionally doesn't have - this two-role split is documented in [Local setup](#local-setup) rather than left as a foot-gun.

### Two chunking strategies, compared on real boundaries

The fixed-size chunker slices by character count with overlap and doesn't care where a sentence ends - it will cut `"Graduation"` into `"...uation"` mid-word if that's where the window lands. The structure-aware chunker splits on paragraph boundaries first, merges small paragraphs up to a target size, and only falls back to sentence-boundary splitting for an unusually large single paragraph - it never cuts through a word or a sentence. Both strategies run on every upload and are stored as separate, labeled sets of `Chunk` rows (`chunkingStrategy: "fixed" | "structure_aware"`), so retrieval quality between them can be measured directly against the same source text rather than asserted.

### Hybrid search: two retrieval methods that fail differently

Vector search finds meaning - it can match "how do I fix a crash" against "troubleshooting application failures" with zero shared words. It's also weak on exact terms: a name or product ID doesn't carry much semantic "meaning" to embed against, so vector-only search can under-rank a chunk that contains the literal answer. Full-text search is the mirror image - exact-term matches are strong, but a paraphrased question that doesn't share vocabulary with the answer gets nothing. Both run against the same candidate pool and are combined with Reciprocal Rank Fusion, which converts each method's *rank position* (not its raw, incompatible score) into a comparable number and sums them - a chunk that both methods rank highly gets a real boost, a chunk only one method found still contributes, and nothing requires normalizing two unrelated scoring scales against each other.

One thing this surfaced directly: a query like *"What is his name"* fails under **both** vector search (a pronoun-based question doesn't semantically resemble a proper noun) and full-text search (`plainto_tsquery` strips "what/is/his" as stop words, leaving only `'name'` - a word that never literally appears next to an actual name in the source text). That specific gap isn't a retrieval problem at all; it's a job for the generation step, which is why the LLM reads the retrieved chunk and correctly infers the name from context even when retrieval's own ranking signal for that exact query is weak.

### Reranking: a real accuracy signal, not just re-ordering

RRF scores across a small candidate set tend to cluster closely (`0.033, 0.016, 0.016, 0.015` is typical) - hard to read confidence from directly. Cross-encoder reranking, which processes the query and each candidate jointly instead of comparing independently-computed embeddings, produces a much sharper signal: on the same candidate set, the genuinely relevant chunk scored `+5.0` while the rest scored `-2.2` to `-10.4` - a decisive gap rather than a close cluster. The ordering of the *non-relevant* results changed too, which is evidence the reranker is doing real evaluation, not just confirming whatever hybrid search already decided.

### Citation grounding, verified against a real failure

The first version of the generation prompt miscited a correct answer - it stated the right fact (a payload capacity figure) but attributed it to the wrong chunk, consistently, across repeated identical runs. That ruled out simple non-determinism; it was a real, reproducible grounding failure. Adding explicit self-verification instructions to the prompt ("before answering, identify which chunk actually contains this fact, then confirm it's really there") fixed it across every subsequent test. The model's own visible reasoning ("this is directly found in chunk 1...") confirmed the instruction was doing real work, not just changing the output by chance - and a second prompt revision then suppressed that visible reasoning from the final answer, since a real user shouldn't see the model's internal verification monologue.

The model is also explicitly instructed to say the context doesn't contain an answer rather than fill the gap - verified with an out-of-scope question (Falcon-X pricing, never mentioned in any document), which it correctly declined to answer rather than guessing.

---

## Evaluation

The harness itself is built: an `EvalQuestion` model stores a question plus its ground-truth chunk ID(s) *per chunking strategy* (since fixed and structure-aware produce different chunks with different IDs for the same source text, a single ground-truth answer can't point at both), and a hit-rate@k scorer runs retrieval for each question and checks whether the expected chunk appears in the top-K results.

The first real run produced a result worth reporting honestly rather than hiding: **100% hit-rate@3 for both strategies**, on a corpus that, at the time, only had 2-3 chunks per strategy total. With a candidate pool that small and K=3, retrieval is close to unable to miss regardless of ranking quality - the number is real, but it isn't a meaningful comparison. The corpus has since been expanded (see `docs/*.pdf` test fixtures), but the eval question set hasn't yet been re-seeded against the larger corpus or extended to compare hybrid vs. vector-only and with/without reranking, which the harness already supports structurally. **This is the next piece of work**, not a finished result - a small-N finding is reported here because reporting only flattering numbers would be a worse signal than reporting a real methodological limitation and what it actually means.

---

## What's not here yet

- **CSV ingestion** - PDF only right now. The chunking/embedding pipeline doesn't care about source format, so this is a parser, not an architecture change.
- **Streaming responses** - answers are returned as a single completed response, not token-streamed. Deprioritized deliberately; not a technical blocker.
- **A frontend** - the entire system is currently exercised through a Postman collection. Built last, deliberately, so it's built against a finished, stable API instead of a moving one.
- **A pluggable hosted-LLM provider** - the original design calls for an interface that swaps between Ollama and a hosted API behind one env var. The embedding/completion calls are already isolated into their own small modules, so this swap is a contained change, but the formal interface hasn't been built - only the local Ollama path currently exists.
- **GraphRAG, agentic multi-step retrieval, multilingual embeddings** - all real, more advanced RAG variants; none of them are the differentiator here. The differentiator is that the fundamentals - isolation, retrieval comparison, reranking, grounding - are built correctly and provably, not that every advanced technique is present.

---

## Project structure

```
stratum/
├── backend/
│   ├── src/
│   │   ├── controllers/       # route handlers - auth, workspace, document, query, hybridQuery, rerankedQuery, chat
│   │   ├── routes/            # Express routers, one per resource
│   │   ├── middleware/        # JWT auth, workspace-ownership check
│   │   ├── db/
│   │   │   ├── client.ts      # Prisma client (driver-adapter based, Prisma 7)
│   │   │   └── withWorkspace.ts  # RLS-scoping transaction wrapper
│   │   ├── lib/
│   │   │   ├── chunking/      # fixedSizeChunker, structureAwareChunker
│   │   │   ├── embeddings/    # Ollama embedding client
│   │   │   ├── llm/           # Ollama completion client
│   │   │   ├── search/        # hybridSearch (RRF)
│   │   │   └── reranker/      # HTTP client for the reranker service
│   │   └── server.ts
│   ├── scripts/               # test-isolation, test-chunking-comparison, run-eval, seed-eval-questions
│   └── prisma/                 # schema + migrations (includes manual raw-SQL migrations for pgvector/tsvector/RLS)
├── reranker/
│   ├── main.py                 # FastAPI + CrossEncoder
│   └── requirements.txt        # CPU-only torch pin
├── uploads/                     # per-workspace uploaded files (Docker volume)
└── docker-compose.yml
```

---

## API reference

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | none | health check |
| `POST` | `/auth/register` | none | create a user, bcrypt-hashed password |
| `POST` | `/auth/login` | none | authenticate, returns a JWT |
| `POST` | `/workspaces` | JWT | create a workspace, owned by the caller |
| `GET` | `/workspaces` | JWT | list the caller's own workspaces |
| `GET` | `/workspaces/:workspaceId` | JWT + ownership | fetch one workspace |
| `POST` | `/workspaces/:workspaceId/documents` | JWT + ownership | upload a PDF; extracts, chunks (both strategies), embeds, stores |
| `POST` | `/workspaces/:workspaceId/query` | JWT + ownership | vector-only search, returns ranked chunks |
| `POST` | `/workspaces/:workspaceId/hybrid-query` | JWT + ownership | vector + full-text search via RRF |
| `POST` | `/workspaces/:workspaceId/reranked-query` | JWT + ownership | hybrid search, then cross-encoder reranked |
| `POST` | `/workspaces/:workspaceId/chat` | JWT + ownership | full pipeline - retrieval, reranking, and a cited generated answer |

---

## Local setup

### 1. Prerequisites

- Docker Desktop, running
- [Ollama](https://ollama.com) installed **natively on the host**, not in Docker (no GPU passthrough to containers on Mac)
- Node.js 20+

### 2. Pull the models

```bash
ollama pull qwen2.5:7b-instruct-q4_K_M
ollama pull nomic-embed-text
```

### 3. Start the containers

```bash
docker compose up -d
```

### 4. Create a non-superuser database role

The default `POSTGRES_USER` in the official Postgres image is a superuser, and superusers bypass Row-Level Security unconditionally - `FORCE ROW LEVEL SECURITY` does not close this gap. The application must connect as a separate, restricted role for RLS to actually apply:

```bash
docker exec -it rag_postgres psql -U rag -d rag_db
```

```sql
CREATE ROLE app_user WITH LOGIN PASSWORD 'app_user_dev_password' CREATEDB;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_user;
```

(`CREATEDB` is required for Prisma's shadow database during migrations - it does not grant RLS bypass, which is tied specifically to the `SUPERUSER` attribute.)

### 5. Environment variables

Copy `backend/.env.example` to `backend/.env`. Use the `app_user` connection string for running the app day-to-day; switch to the `rag` superuser connection string only when running a schema migration, then switch back:

```bash
# running the app
DATABASE_URL="postgresql://app_user:app_user_dev_password@localhost:5432/rag_db"

# running a migration (temporarily)
DATABASE_URL="postgresql://rag:rag_dev_password@localhost:5432/rag_db"
```

### 6. Install, migrate, verify isolation

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run test:isolation   # should print two PASS lines
```

### 7. Run

```bash
npm run dev
```

Server listens on `:4000`. `curl http://localhost:4000/health` should return `{"status":"ok"}`.

---

## Author

Built by Sagar Lonkar, [GitHub](https://github.com/SagarLonkar-18)
