import { prisma } from "../src/db/client";
import { withWorkspace } from "../src/db/withWorkspace";
import { generateEmbedding } from "../src/lib/embeddings/ollamaEmbeddings";
import { hybridSearch } from "../src/lib/search/hybridSearch";

const WORKSPACE_ID = "e8774480-7e08-4c4b-ba97-dc3a6b8d3944";
const TOP_K = 5;

async function main() {
	const questions = await prisma.evalQuestion.findMany({
		where: { workspaceId: WORKSPACE_ID },
	});

	const results: Record<string, { hits: number; total: number }> = {};

	for (const q of questions) {
		const embedding = await generateEmbedding(q.question);

		const retrieved = await withWorkspace(WORKSPACE_ID, (tx) =>
			hybridSearch(
				tx,
				WORKSPACE_ID,
				q.question,
				embedding,
				q.chunkingStrategy,
				TOP_K,
			),
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

	console.log("\n=== Hybrid Search Hit Rate @ K=" + TOP_K + " ===");
	for (const [strategy, { hits, total }] of Object.entries(results)) {
		const rate = ((hits / total) * 100).toFixed(1);
		console.log(`${strategy}: ${hits}/${total} = ${rate}%`);
	}
}

main()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
