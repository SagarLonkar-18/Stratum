# Stratum

A locally-run, multi-tenant RAG knowledge base with hybrid search and reranking.

> **Note on scope**: this README grows alongside the build. It documents what's
> actually implemented, not the full end-state feature list up front.

## Current status

- [x] Docker Compose skeleton: Postgres+pgvector, backend, reranker containers
- [x] Prisma schema: `User`, `Workspace`, `Document`, `Chunk`
- [x] User registration + login (bcrypt password hashing, JWT sessions)
- [x] JWT auth middleware protecting routes
- [x] Workspace creation, scoped to the authenticated user
- [x] Row-Level Security enabled on `Document` and `Chunk`, with an automated
      test proving cross-workspace queries are blocked at the database layer
- [ ] Document upload + chunking
- [ ] Embeddings + vector storage
- [ ] Hybrid search (vector + full-text)
- [ ] Reranking
- [ ] Citations + streaming answers
- [ ] Evaluation harness

## Architecture

- **Backend**: Node.js + TypeScript, Express
- **Database**: PostgreSQL + pgvector, via Prisma ORM (raw SQL for anything
  Prisma can't express — the pgvector column, full-text index, and RLS
  policies, once those land)
- **Auth**: email + bcrypt-hashed password, JWT access tokens (24h expiry,
  no refresh-token rotation — a deliberate scope decision, not an oversight)
- **Tenant isolation**: Postgres Row-Level Security, not just an
  application-layer `WHERE workspaceId = ...` convention. Every request
  scopes its database transaction to a workspace via `withWorkspace()`
  (`backend/src/db/withWorkspace.ts`), and RLS policies on `Document`/`Chunk`
  make rows from other workspaces genuinely invisible to the query — even a
  query that forgets to filter at all. See
  `backend/scripts/test-isolation.ts` for the automated proof, including
  that an unscoped query returns **zero** rows, not all rows (fails closed).
- **LLM + embeddings** (once implemented): Ollama running natively on macOS
  host — Docker Desktop on Mac has no Metal/GPU passthrough, so Ollama can't
  run inside a container here. The backend reaches it via
  `host.docker.internal`.
- **Reranker** (once implemented): a standalone local Python/FastAPI service
  running a cross-encoder model. Deliberately local-only — not part of any
  provider-swap layer.

## Local setup

### 1. Prerequisites

- Docker Desktop, running
- [Ollama](https://ollama.com) installed natively on the host (not in Docker)
- Node.js 20+

### 2. Start the containers

\`\`\`
docker compose up -d
\`\`\`

This starts Postgres (with the `pgvector` extension available), plus
placeholder backend/reranker containers — real app code currently runs
locally via `npm run dev`, not inside the backend container, while it's
still under active development.

### 3. Create a non-superuser database role

The default `POSTGRES_USER` in the official Postgres Docker image is a
**superuser**, and Postgres superusers always bypass Row-Level Security —
`FORCE ROW LEVEL SECURITY` does not close this gap, it only affects
non-superuser table owners. If the app connects as the superuser, RLS
policies silently do nothing, with no error or warning. (This was found and
fixed via `test-isolation.ts` during development — see commit history.)

Connect as the superuser and create a separate, ordinary login role for the
app to actually use:

\`\`\`
docker exec -it rag_postgres psql -U rag -d rag_db
\`\`\`

\`\`\`sql
CREATE ROLE app_user WITH LOGIN PASSWORD 'app_user_dev_password';
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_user;
\q
\`\`\`

### 4. Configure environment variables

In `backend/.env`:

\`\`\`
DATABASE_URL="postgresql://app_user:app_user_dev_password@localhost:5432/rag_db"
PORT=4000
JWT_SECRET=<any long random string for local dev>
\`\`\`

Use `app_user`, not `rag`, in `DATABASE_URL` — see step 3 for why.

### 5. Install dependencies and run migrations

\`\`\`
cd backend
npm install
npx prisma generate
npx prisma migrate dev
\`\`\`

### 6. Verify tenant isolation holds

\`\`\`
npm run test:isolation
\`\`\`

Should print two `PASS` lines. This is the project's core structural
guarantee — if this fails, isolation is broken at the database layer, not
just the application layer.

### 7. Run the backend

\`\`\`
npm run dev
\`\`\`

Server listens on `:4000` (not `:3000` — the Dockerized backend placeholder
still occupies `:3000` while local dev runs alongside it).

\`\`\`
curl http://localhost:4000/health
\`\`\`