# Stratum

A locally-run, multi-tenant RAG knowledge base with hybrid search and reranking - built for organizations that can't send their documents to a cloud LLM API.

New here? See [QUICKSTART.md](./QUICKSTART.md) for the fastest path to a running instance.

---

## Why this project

Most "chat with your PDF" projects call an embedding API, drop vectors into a vector store, and call it done. That's a fine afternoon project, but it skips every interesting problem: how do you actually know your retrieval is working? Does your chunking strategy matter, or is it cargo-culted from a tutorial? What happens when two different customers' documents live in the same database - does your isolation hold up if someone forgets a `WHERE` clause, or does it just rely on nobody making a mistake?

Stratum exists to answer those questions properly, for a specific, real constraint: some organizations - healthcare, legal, defense, anyone with a data-residency requirement - genuinely cannot send their documents to OpenAI or Anthropic's servers. So this runs fully local: local embeddings, local generation, local reranking, no API key required, no data leaving the machine.

The interesting engineering here is structural multi-tenant isolation enforced by the database itself (not application code), a measured comparison between two chunking strategies instead of picking one on faith, hybrid retrieval that combines semantic and lexical search because each one fails differently, a reranking step whose actual before/after effect is visible in the scores, and a full working product on top of it - not just an API that only a Postman collection has ever exercised.

---

## Screenshot

![Stratum chat with a clicked citation and its source chunk](./docs/screenshots/chat.png)

A question answered entirely from retrieved chunks, with an inline citation chip (`[1]`) that's clickable - clicking it highlights the exact source chunk in the panel on the right, so any claim in the answer can be traced back to real, specific document content.
---

## Features

- **Multi-tenant workspaces** - each user's workspaces are isolated from every other user's, enforced at the database layer via Postgres Row-Level Security, not just an app-layer filter. Full CRUD (create, rename, delete) from the UI, with a free-text "type" field that suggests previously-used values instead of forcing a choice between two hardcoded categories.
- **PDF and CSV ingestion** - upload, extract, and automatically chunk on upload. CSV rows are converted into readable `column: value` text and fed through the same chunking/embedding pipeline as PDFs - no parallel ingestion path.
- **Two chunking strategies, stored side by side** - a naive fixed-size sliding window and a structure-aware chunker that respects paragraph and sentence boundaries. Both run on every upload so they can be directly compared.
- **Hybrid search** - vector similarity (pgvector, cosine distance) and Postgres full-text search, combined via Reciprocal Rank Fusion, because they fail in different places and neither alone is enough.
- **Cross-encoder reranking** - a standalone FastAPI service re-scores the top candidates with a real cross-encoder model before they reach the LLM.
- **Grounded, cited answers** - the LLM answers only from retrieved chunks, cites which chunk each claim came from, and is explicitly instructed to say "I don't know" rather than fill gaps or fall back on its own training knowledge - verified against real miscitation and knowledge-leak failures, not just assumed to work.
- **Persisted, conversation-aware chat** - questions and answers are stored per-conversation (`Message` rows with `role`/`content`/`sources`, mirroring how LLM chat APIs represent turns), and recent conversation history is passed back to the model so follow-up questions like "what about its pricing?" resolve correctly. Conversation history is itself RLS-protected, same as documents and chunks.
- **A real frontend, not just a Postman collection** - login/register, workspace management, drag-to-resize side panels with persisted width, document upload and deletion, and a chat interface where inline citation chips (`[1]`, `[2]`) are clickable and highlight their exact source chunk in a side panel.
- **Fully local inference** - Ollama running natively on the host (not in Docker, since Docker Desktop on Mac has no GPU passthrough) for both embeddings and generation. No API key, no per-request cost, no data leaving the machine.

---

## Architecture

![Stratum system architecture](./docs/architecture-diagram.svg)

**Frontend** - React + TypeScript + Vite, styled with Tailwind v4 using a custom design-token theme (not default utility colors). Talks to the backend via axios with a fixed `baseURL`, deliberately *not* through Vite's dev-server proxy - proxying `/workspaces` collided with the frontend's own `/workspaces/:id` page route on a hard browser reload, since both are the same path from the browser's perspective. Separating the two into genuinely different origins (and adding CORS on the backend to allow it) fixed this permanently rather than working around it with header-sniffing.

**Backend** - Node.js + Express + TypeScript, containerized with Docker.

**Database** - PostgreSQL with the `pgvector` extension, via Prisma. Things Prisma can't express natively - the `vector` column, the full-text `tsvector` generated column - are added via raw SQL migrations and marked `Unsupported()` in the schema so Prisma knows they exist and won't silently drop them on a future auto-migration (this happened once during development; see [Key engineering decisions](#key-engineering-decisions)).

**Tenant isolation** - every `Chunk`/`Document`/`Conversation` query runs inside a transaction that first sets `app.workspace_id` via `SET LOCAL`, then Postgres Row-Level Security policies filter every subsequent query to that workspace automatically - including queries that forget a `WHERE` clause entirely. If the scope is never set, the policy evaluates to unknown and returns zero rows, not all rows: it fails closed.

**LLM + embeddings** - Ollama, running natively on the host. `nomic-embed-text` for embeddings (768-dim), `qwen2.5:7b-instruct`, 4-bit quantized, for generation. The backend reaches it via `host.docker.internal` since the container can't see `localhost` on the host directly.

**Reranker** - a separate Python/FastAPI service running `cross-encoder/ms-marco-MiniLM-L-6-v2` via `sentence-transformers`, CPU-only (the default install pulls GPU/CUDA wheels that are useless in a Docker container with no GPU passthrough - pinning the CPU-only PyTorch build cut the image download from several GB to under 300MB).

**File storage** - uploaded files are saved to disk, namespaced by workspace (`uploads/<workspaceId>/<documentId>-<filename>`), inside a Docker-mounted volume.

---

## Key engineering decisions

### Tenant isolation as a structural guarantee, not a convention

`workspaceId` is denormalized directly onto `Chunk`, not only reachable via a join through `Document` - this keeps the RLS policy a single-column check and lets a `(workspaceId, embedding)` index be used directly by vector search instead of requiring a join at query time. Every request that touches `Chunk`/`Document`/`Conversation` goes through a `withWorkspace(workspaceId, fn)` wrapper that opens a transaction, sets the RLS scope, and only then runs the query - so there is no code path where a query can run unscoped and still return real data.

This was tested, not assumed: an automated test seeds two workspaces, then deliberately runs a query with no `WHERE` clause at all, scoped only via the transaction context, and asserts it returns exactly the calling workspace's data. That test caught a real bug during development - the database's default `POSTGRES_USER` in the official Docker image is a **superuser**, and Postgres superusers bypass Row-Level Security unconditionally, even with `FORCE ROW LEVEL SECURITY` set. The application now connects as a separate, deliberately non-superuser role (`CREATEDB` only, no `SUPERUSER`) specifically so RLS actually applies to it. Schema migrations still require the superuser role, since altering tables needs owner privileges the restricted role intentionally doesn't have - this two-role split is documented in [Local setup](#local-setup) rather than left as a foot-gun.

### Two chunking strategies, compared on real boundaries

The fixed-size chunker slices by character count with overlap and doesn't care where a sentence ends - it will cut `"Graduation"` into `"...uation"` mid-word if that's where the window lands. The structure-aware chunker splits on paragraph boundaries first, merges small paragraphs up to a target size, and only falls back to sentence-boundary splitting for an unusually large single paragraph - it never cuts through a word or a sentence. Both strategies run on every upload and are stored as separate, labeled sets of `Chunk` rows (`chunkingStrategy: "fixed" | "structure_aware"`), so retrieval quality between them can be measured directly against the same source text rather than asserted.

CSV files reuse this exact same pipeline: each row is rendered as `Column: value, Column: value` text (blank-line-separated between rows), which converges into the same `extractedText` string a PDF's extraction produces - the chunker, embedder, and everything downstream has no idea, or need to know, whether a given chunk originated from a PDF or a spreadsheet row.

### Hybrid search: two retrieval methods that fail differently

Vector search finds meaning - it can match "how do I fix a crash" against "troubleshooting application failures" with zero shared words. It's also weak on exact terms: a name or product ID doesn't carry much semantic "meaning" to embed against, so vector-only search can under-rank a chunk that contains the literal answer. Full-text search is the mirror image - exact-term matches are strong, but a paraphrased question that doesn't share vocabulary with the answer gets nothing. Both run against the same candidate pool and are combined with Reciprocal Rank Fusion, which converts each method's *rank position* (not its raw, incompatible score) into a comparable number and sums them - a chunk that both methods rank highly gets a real boost, a chunk only one method found still contributes, and nothing requires normalizing two unrelated scoring scales against each other.

One thing this surfaced directly: a query like *"What is his name"* fails under **both** vector search (a pronoun-based question doesn't semantically resemble a proper noun) and full-text search (`plainto_tsquery` strips "what/is/his" as stop words, leaving only `'name'` - a word that never literally appears next to an actual name in the source text). That specific gap isn't a retrieval problem at all; it's a job for the generation step, which is why the LLM reads the retrieved chunk and correctly infers the name from context even when retrieval's own ranking signal for that exact query is weak.

### Reranking: a real accuracy signal, not just re-ordering

RRF scores across a small candidate set tend to cluster closely (`0.033, 0.016, 0.016, 0.015` is typical) - hard to read confidence from directly. Cross-encoder reranking, which processes the query and each candidate jointly instead of comparing independently-computed embeddings, produces a much sharper signal: on the same candidate set, the genuinely relevant chunk scored `+5.0` while the rest scored `-2.2` to `-10.4` - a decisive gap rather than a close cluster. The ordering of the *non-relevant* results changed too, which is evidence the reranker is doing real evaluation, not just confirming whatever hybrid search already decided.

### Citation grounding, verified against two real failures

The first version of the generation prompt miscited a correct answer - it stated the right fact (a payload capacity figure) but attributed it to the wrong chunk, consistently, across repeated identical runs. That ruled out simple non-determinism; it was a real, reproducible grounding failure. Adding explicit self-verification instructions to the prompt ("before answering, identify which chunk actually contains this fact, then confirm it's really there") fixed it across every subsequent test, and a second prompt revision suppressed the model's now-visible verification monologue from the final answer, since a real user shouldn't see that.

A second, subtler failure surfaced later, through actual use rather than planned testing: asking an out-of-scope question ("what is your name") against a corpus with no relevant content caused the model to correctly note the documents didn't cover it, but then answer from its own training knowledge anyway ("I am Qwen, created by Alibaba Cloud") and falsely attach a citation to that claim - a wrong citation on a claim that happened to be true, arguably a harder failure mode to catch than a wrong fact. The prompt now explicitly forbids using training knowledge for any claim, including about the model's own identity, and forbids attaching a citation to a refusal at all. Both fixes were verified with the exact adversarial questions that found the original bugs, not just the happy path.

### Conversation persistence: role-based messages, not bundled Q&A pairs

Messages are stored as individual rows (`role: "user" | "assistant"`, `content`, `sources`) rather than one row per question-answer pair. This matches the shape every LLM chat API itself expects when you send conversation history - which is exactly why it mattered: passing recent messages back into the generation prompt (for follow-up-question support) required zero reshaping, since the stored format already matches the API's expected input shape.

Conversational memory currently only reaches the *generation* step, not retrieval - a genuine, tested gap worth being precise about, not glossed over. A follow-up like "what about its pricing?" gets the right answer when the question itself still contains enough distinctive vocabulary for retrieval to find the correct chunk on its own (verified: "does it support ACID transactions?" correctly resolved to DynamoDB mid-conversation). But retrieval runs on the literal question text alone, before conversation history is ever consulted - so a genuinely ambiguous follow-up can retrieve the wrong document's chunks entirely, and the LLM will then correctly and honestly say the (wrong) chunks don't contain the answer, rather than silently failing. The real fix - reformulating a follow-up into a self-contained query via a small LLM call before retrieval - is a straightforward next iteration, not a structural limitation of the current design.

---

## Evaluation

The harness runs real questions against real retrieval, comparing three retrieval methods across both chunking strategies, using a genuine 5-document corpus (excerpts from the official AWS S3, EC2, VPC, DynamoDB, and Lambda user guides - real technical documentation, not synthetic filler). 10 questions, each with a ground-truth chunk verified by direct lookup, run twice (once per chunking strategy) for 20 total eval rows.

| Method | Fixed-size | Structure-aware |
|---|---|---|
| Vector-only, K=3 | 100% | 70% |
| Vector-only, K=5 | 100% | 80% |
| Hybrid (vector + full-text), K=5 | 100% | 80% |
| Hybrid + reranked, K=5 | **100%** | **100%** |

**Why fixed-size scores higher before reranking**: fixed-size chunking overlaps consecutive chunks by 200 characters, so a fact sitting near a chunk boundary exists in *two* chunks rather than one - each question effectively gets two chances at a hit. Structure-aware chunking has no overlap, so each fact exists in exactly one, cleaner chunk - fewer chances, but no duplicated or boundary-cut content. This is a real tradeoff, not simply "fixed-size is better": duplicated chunks cost more storage and more embeddings computed for no informational gain.

**Why hybrid search didn't recover structure-aware's two misses (EC2 security groups, VPC peering)**: both failures were on questions phrased around a concept rather than naming it directly - e.g. "how do you connect two separate VPCs" never says the word "peering." Full-text search can only help when the query contains the same literal term the answer does; a paraphrased question gets no benefit from it, and both misses fell back entirely on vector similarity, which occasionally ranked a topically-adjacent-but-wrong chunk (VPC CIDR block configuration) above the actually correct one (VPC peering).

**Why reranking recovered both**: unlike vector or full-text search, a cross-encoder evaluates the query and each candidate jointly rather than comparing independently-computed similarity scores - it doesn't matter that structure-aware only had one "chance" at the right chunk instead of two, because reranking is actually judging content, not relying on an approximate proxy. This took structure-aware from 70-80% to a clean 100%, fully closing the gap with fixed-size chunking's overlap-assisted score.

Building this corpus also surfaced a real data-quality issue worth documenting: the AWS user guide PDFs, as excerpted, contained large table-of-contents sections (referencing page numbers into the full multi-thousand-page master documents) that the naive PDF-text extraction included as if they were real content. Early ingestion runs produced chunks that were 80%+ table-of-contents noise. The source PDFs were manually re-trimmed to their genuine content pages before the eval numbers above were produced - the chunker does not currently detect and filter structural noise like this automatically, which is a known limitation for any future document with a similarly long front-matter section.

Eval scripts: `scripts/seed-aws-eval-questions.ts` (question seeding), `scripts/find-ground-truth.ts` (ground-truth lookup by phrase search), `scripts/run-eval.ts` / `run-eval-hybrid.ts` / `run-eval-reranked.ts` (the three comparison runs above).

---

## Project structure

```
stratum/
├── frontend/
│   ├── src/
│   │   ├── pages/              # AuthPage, WorkspacesPage, ChatPage
│   │   ├── components/         # AnswerText (citation chips), SourcePanel, Combobox, ProtectedRoute
│   │   ├── lib/
│   │   │   ├── api.ts          # axios client, fixed baseURL, auth interceptor
│   │   │   ├── auth.tsx        # auth context
│   │   │   └── useResizable.ts # drag-to-resize side panel hook, persisted width
│   │   └── App.tsx
│   └── vite.config.ts
├── backend/
│   ├── src/
│   │   ├── controllers/       # auth, workspace, document, query, hybridQuery, rerankedQuery, chat, conversation
│   │   ├── routes/            # Express routers, one per resource
│   │   ├── middleware/        # JWT auth, workspace-ownership check, multer upload config
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
│   ├── scripts/               # test-isolation, test-chunking, test-chunking-comparison,
│   │                          # test-embedding, find-ground-truth,
│   │                          # run-eval / run-eval-hybrid / run-eval-reranked,
│   │                          # seed-eval-questions / seed-aws-eval-questions
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
| `PATCH` | `/workspaces/:workspaceId` | JWT + ownership | rename a workspace / change its type |
| `DELETE` | `/workspaces/:workspaceId` | JWT + ownership | delete a workspace, cascades to its documents, chunks, conversations, and files on disk |
| `POST` | `/workspaces/:workspaceId/documents` | JWT + ownership | upload a PDF or CSV; extracts, chunks (both strategies), embeds, stores |
| `GET` | `/workspaces/:workspaceId/documents` | JWT + ownership | list a workspace's documents |
| `DELETE` | `/workspaces/:workspaceId/documents/:documentId` | JWT + ownership | delete a single document, its chunks, and its file on disk |
| `POST` | `/workspaces/:workspaceId/query` | JWT + ownership | vector-only search, returns ranked chunks |
| `POST` | `/workspaces/:workspaceId/hybrid-query` | JWT + ownership | vector + full-text search via RRF |
| `POST` | `/workspaces/:workspaceId/reranked-query` | JWT + ownership | hybrid search, then cross-encoder reranked |
| `POST` | `/workspaces/:workspaceId/chat` | JWT + ownership | full pipeline - retrieval, reranking, and a cited, conversation-aware generated answer; creates or continues a `Conversation` |
| `GET` | `/workspaces/:workspaceId/conversations` | JWT + ownership | list a workspace's conversations |
| `GET` | `/workspaces/:workspaceId/conversations/:conversationId` | JWT + ownership | fetch one conversation's full message history |
| `PATCH` | `/workspaces/:workspaceId/conversations/:conversationId` | JWT + ownership | rename a conversation |
| `DELETE` | `/workspaces/:workspaceId/conversations/:conversationId` | JWT + ownership | delete a conversation and its associated messages |

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

### 3. Start Ollama

```bash
ollama serve
```

Leave this running in its own terminal tab - it needs to stay up for the backend to reach it. Ollama doesn't persist as a background service by default, so this needs to be run at the start of every session.

### 4. Start the containers

```bash
docker compose up -d
```

### 5. Create a non-superuser database role

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

### 6. Backend environment variables

Copy `backend/.env.example` to `backend/.env`. Use the `app_user` connection string for running the app day-to-day; switch to the `rag` superuser connection string only when running a schema migration, then switch back:

```bash
# running the app
DATABASE_URL="postgresql://app_user:app_user_dev_password@localhost:5432/rag_db"

# running a migration (temporarily)
DATABASE_URL="postgresql://rag:rag_dev_password@localhost:5432/rag_db"
```

### 7. Install, migrate, verify isolation

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run test:isolation   # should print two PASS lines
```

### 8. Run the backend

```bash
npm run dev
```

Server listens on `:4000`. `curl http://localhost:4000/health` should return `{"status":"ok"}`.

### 9. Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:4000" > .env
npm run dev
```

Opens on `:5173`. The frontend talks directly to the backend's origin (not through a dev-server proxy - see [Architecture](#architecture) for why), so the backend's CORS config must allow `http://localhost:5173`, which it does by default in local dev.

---

## Author

Built by Sagar Lonkar, [GitHub](https://github.com/SagarLonkar-18)
