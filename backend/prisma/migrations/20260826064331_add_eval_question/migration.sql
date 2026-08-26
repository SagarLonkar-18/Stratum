-- DropIndex
DROP INDEX "chunk_embedding_hnsw_idx";

-- CreateTable
CREATE TABLE "EvalQuestion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "expectedChunkIds" TEXT[],
    "chunkingStrategy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvalQuestion_workspaceId_idx" ON "EvalQuestion"("workspaceId");

-- AddForeignKey
ALTER TABLE "EvalQuestion" ADD CONSTRAINT "EvalQuestion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
