import { prisma } from "../src/db/client";
import { withWorkspace } from "../src/db/withWorkspace";
import { generateEmbedding } from "../src/lib/embeddings/ollamaEmbeddings";

const WORKSPACE_ID = "ace27d6a-51fa-47cd-9464-4b299371828f";
const TOP_K = 3;

interface RetrievalResult {
	id: string;
	distance: number;
}

async function retrieveTopK(
	workspaceId: string,
	question: string,
	chunkingStrategy: string,
	k: number,
): Promise<RetrievalResult[]> {
	const embedding = await generateEmbedding(question);
	const vectorLiteral = `[${embedding.join(",")}]`;

	return withWorkspace(workspaceId, (tx) =>
		tx.$queryRawUnsafe<RetrievalResult[]>(
			`SELECT id, embedding <=> $1::vector AS distance
       FROM "Chunk"
       WHERE "workspaceId" = $2 AND "chunkingStrategy" = $3
       ORDER BY distance ASC
       LIMIT $4`,
			vectorLiteral,
			workspaceId,
			chunkingStrategy,
			k,
		),
	);
}

async function main() {
	const questions = await prisma.evalQuestion.findMany({
		where: { workspaceId: WORKSPACE_ID },
	});

	const results: Record<string, { hits: number; total: number }> = {};

	for (const q of questions) {
		const retrieved = await retrieveTopK(
			WORKSPACE_ID,
			q.question,
			q.chunkingStrategy,
			TOP_K,
		);
		const retrievedIds = retrieved.map((r) => r.id);

		const isHit = q.expectedChunkIds.some((expectedId) =>
			retrievedIds.includes(expectedId),
		);

		if (!results[q.chunkingStrategy]) {
			results[q.chunkingStrategy] = { hits: 0, total: 0 };
		}
		results[q.chunkingStrategy].total++;
		if (isHit) results[q.chunkingStrategy].hits++;

		console.log(
			`[${q.chunkingStrategy}] "${q.question}" → ${isHit ? "HIT" : "MISS"} (expected: ${q.expectedChunkIds.join(", ")}, retrieved: ${retrievedIds.join(", ")})`,
		);
	}

	console.log("\n=== Hit Rate @ K=" + TOP_K + " ===");
	for (const [strategy, { hits, total }] of Object.entries(results)) {
		const rate = ((hits / total) * 100).toFixed(1);
		console.log(`${strategy}: ${hits}/${total} = ${rate}%`);
	}
}

main()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
