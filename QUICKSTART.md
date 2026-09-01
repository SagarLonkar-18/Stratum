# Quickstart

Fastest path to a running Stratum. For the reasoning behind any step, see the full [README](./README.md).

## Prerequisites

- Docker Desktop, running
- [Ollama](https://ollama.com), installed natively (not in Docker)
- Node.js 20+

## 1. Pull models and start Ollama

```bash
ollama pull qwen2.5:7b-instruct-q4_K_M
ollama pull nomic-embed-text
ollama serve
```

Leave this running in its own terminal tab.

## 2. Start the containers

In a new terminal tab:

```bash
docker compose up -d
```

## 3. Create the app database role

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

Type `\q` to exit.

> On a fresh Docker volume, this can also run automatically via
> `backend/docker/init-app-user.sql` - see the README's Local Setup section
> for details. Manual steps above always work regardless.

## 4. Backend

```bash
cd backend
cp .env.example .env
```

Stratum uses **two different database roles**, and `.env` needs whichever one matches what you're about to do:

| Role | Used for | Connection string |
|---|---|---|
| `app_user` | Running the app day-to-day (`npm run dev`) | `postgresql://app_user:app_user_dev_password@localhost:5432/rag_db` |
| `rag` | Schema migrations only (`npx prisma migrate dev`) | `postgresql://rag:rag_dev_password@localhost:5432/rag_db` |

`app_user` is a deliberately restricted, non-superuser role - this is what makes Row-Level Security actually enforceable (see the README for why). It can't run schema migrations, since that requires table-owner privileges it intentionally doesn't have. `rag` is the Postgres superuser created by the Docker image itself - only ever needed for the one-time migration step below.

Edit `.env` and set `DATABASE_URL` to the **`rag`** connection string first, since you need to run a migration before the app can start:
```
DATABASE_URL="postgresql://rag:rag_dev_password@localhost:5432/rag_db"
```

```bash
npm install
npx prisma generate
npx prisma migrate dev
```

Now switch `DATABASE_URL` in `.env` to the **`app_user`** connection string - this is what the running app actually uses:
```
DATABASE_URL="postgresql://app_user:app_user_dev_password@localhost:5432/rag_db"
```

```bash
npm run test:isolation
```

Should print two `PASS` lines - if it doesn't, stop here and check the README's Local Setup section before continuing.

```bash
npm run dev
```

Confirm it's up: `curl http://localhost:4000/health` should return `{"status":"ok"}`.

## 5. Frontend

In a new terminal tab:

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:4000" > .env
npm run dev
```

Opens on `http://localhost:5173`.

## 6. Use it

1. Register an account
2. Create a workspace
3. Upload a PDF or CSV
4. Ask it a question

## Common issues

**`ECONNREFUSED` from an embedding or chat request** - Ollama isn't running. Go back to step 1.

**`Reranker request failed`** - check `docker ps` for `rag_reranker`; if it's not `Up`, run `docker compose up -d reranker` and check `docker logs rag_reranker`.

**A hard page refresh shows raw JSON instead of the app** - make sure the frontend's `VITE_API_URL` points at the backend directly (`http://localhost:4000`), and that you're not routing through a dev-server proxy - see the README's Architecture section for why this matters.

**Migration commands fail with a permissions error** - `DATABASE_URL` is set to `app_user`, not `rag`. See the table in step 4 - migrations need the `rag` connection string; switch back to `app_user` once the migration succeeds.
