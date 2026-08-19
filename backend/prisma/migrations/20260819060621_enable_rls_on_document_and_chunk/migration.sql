-- Row-Level Security: enforce workspace isolation at the database layer,
-- not just via application-code WHERE clauses.
--
-- Every request must run SET LOCAL app.workspace_id before querying
-- Document/Chunk. Policies below then restrict visible rows to that
-- workspace only — automatically, on every query, regardless of how it's
-- written.

ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Chunk" ENABLE ROW LEVEL SECURITY;

-- FORCE ensures RLS applies even to the table owner (our app's own DB
-- user). Without FORCE, the owning role bypasses RLS by default — which
-- would silently defeat the isolation guarantee, since our backend
-- connects as that owning role.
ALTER TABLE "Document" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Chunk" FORCE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation_document ON "Document"
  USING ("workspaceId" = current_setting('app.workspace_id', true));

CREATE POLICY workspace_isolation_chunk ON "Chunk"
  USING ("workspaceId" = current_setting('app.workspace_id', true));

-- current_setting(..., true) returns NULL instead of erroring if unset.
-- NULL compared to anything is UNKNOWN in SQL, which Postgres treats as
-- false for filtering purposes — so a connection that forgets to set
-- app.workspace_id sees ZERO rows, not all rows. Fails closed, not open.