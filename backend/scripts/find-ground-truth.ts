import { prisma } from "../src/db/client";
import { withWorkspace } from "../src/db/withWorkspace";

const WORKSPACE_ID = "e8774480-7e08-4c4b-ba97-dc3a6b8d3944";

async function main() {
	const phrase = process.argv[2];
	if (!phrase) {
		console.error(
			'Usage: npx tsx scripts/find-ground-truth.ts "exact phrase"',
		);
		process.exit(1);
	}

	const results = await withWorkspace(WORKSPACE_ID, (tx) =>
		tx.$queryRawUnsafe<
			{
				filename: string;
				chunkingStrategy: string;
				id: string;
				chunkIndex: number;
			}[]
		>(
			`SELECT d.filename, c."chunkingStrategy", c.id, c."chunkIndex"
       FROM "Chunk" c
       JOIN "Document" d ON c."documentId" = d.id
       WHERE c."workspaceId" = $1 AND c.content ILIKE $2
       ORDER BY d.filename, c."chunkingStrategy"`,
			WORKSPACE_ID,
			`%${phrase}%`,
		),
	);

	console.log(`\nFound ${results.length} chunk(s) containing: "${phrase}"\n`);
	results.forEach((r) => {
		console.log(
			`  ${r.filename} [${r.chunkingStrategy}] chunk ${r.chunkIndex} → ${r.id}`,
		);
	});
}

main()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
