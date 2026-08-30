-- Row-Level Security for Conversation, matching the same pattern used for
-- Document/Chunk: every query must run inside a transaction that first
-- sets app.workspace_id via SET LOCAL, or it sees zero rows, not all rows.
--
-- Message is deliberately NOT given its own RLS policy — it has no
-- workspaceId column of its own (only conversationId), and in practice
-- Message rows are always accessed by joining through their parent
-- Conversation, which is itself RLS-protected. Adding a second policy here
-- would mean denormalizing workspaceId onto Message too, which isn't
-- needed for how this feature is actually queried.

ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Conversation" FORCE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation_conversation ON "Conversation"
  USING ("workspaceId" = current_setting('app.workspace_id', true));