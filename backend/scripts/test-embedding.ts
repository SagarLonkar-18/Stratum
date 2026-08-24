import { generateEmbedding } from "../src/lib/embeddings/ollamaEmbeddings";

async function main() {
	const text =
		"Full Stack Developer with experience building production-grade web applications.";
	const embedding = await generateEmbedding(text);

	console.log(`Embedding dimensions: ${embedding.length}`);
	console.log(`First 10 values: ${embedding.slice(0, 10)}`);
}

main().catch(console.error);
