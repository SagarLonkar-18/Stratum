import type { prisma } from "../../db/client";

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface HybridSearchResult {
	id: string;
	content: string;
	chunkIndex: number;
	rrfScore: number;
}

const RRF_K = 60; // standard constant from the original RRF paper

export async function hybridSearch(
	tx: TransactionClient,
	workspaceId: string,
	queryText: string,
	queryEmbedding: number[],
	chunkingStrategy: string,
	topK: number,
): Promise<HybridSearchResult[]> {
	const vectorLiteral = `[${queryEmbedding.join(",")}]`;

	return tx.$queryRawUnsafe<HybridSearchResult[]>(
		`WITH vector_ranked AS (
       SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector) AS rank
       FROM "Chunk"
       WHERE "workspaceId" = $2 AND "chunkingStrategy" = $3
       ORDER BY embedding <=> $1::vector
       LIMIT 50
     ),
     fulltext_ranked AS (
       SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank(content_tsv, plainto_tsquery('english', $4)) DESC) AS rank
       FROM "Chunk"
       WHERE "workspaceId" = $2 AND "chunkingStrategy" = $3
         AND content_tsv @@ plainto_tsquery('english', $4)
       ORDER BY ts_rank(content_tsv, plainto_tsquery('english', $4)) DESC
       LIMIT 50
     ),
     combined AS (
       SELECT
         COALESCE(v.id, f.id) AS id,
         COALESCE(1.0 / ($5 + v.rank), 0.0) + COALESCE(1.0 / ($5 + f.rank), 0.0) AS rrf_score
       FROM vector_ranked v
       FULL OUTER JOIN fulltext_ranked f ON v.id = f.id
     )
     SELECT c.id, c.content, c."chunkIndex", combined.rrf_score AS "rrfScore"
     FROM combined
     JOIN "Chunk" c ON c.id = combined.id
     ORDER BY combined.rrf_score DESC
     LIMIT $6`,
		vectorLiteral,
		workspaceId,
		chunkingStrategy,
		queryText,
		RRF_K,
		topK,
	);
}
