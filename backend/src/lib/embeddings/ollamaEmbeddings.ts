const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const EMBED_MODEL = "nomic-embed-text";

/**
 * Calls Ollama's embedding API for a single piece of text.
 * Returns a 768-dimensional vector matching nomic-embed-text's output.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
	const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
	});

	if (!res.ok) {
		throw new Error(
			`Ollama embedding request failed: ${res.status} ${await res.text()}`,
		);
	}

	const data = (await res.json()) as { embedding: number[] };
	return data.embedding;
}
