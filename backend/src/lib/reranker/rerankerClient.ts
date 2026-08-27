const RERANKER_URL = process.env.RERANKER_URL ?? "http://localhost:8001";

export interface RerankCandidate {
	id: string;
	content: string;
}

export interface RerankedResult {
	id: string;
	score: number;
}

export async function rerank(
	query: string,
	candidates: RerankCandidate[],
	topK: number,
): Promise<RerankedResult[]> {
	const res = await fetch(`${RERANKER_URL}/rerank`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ query, candidates, top_k: topK }),
	});

	if (!res.ok) {
		throw new Error(
			`Reranker request failed: ${res.status} ${await res.text()}`,
		);
	}

	return res.json();
}
