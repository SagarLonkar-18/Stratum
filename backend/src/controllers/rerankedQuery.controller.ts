import type { Request, Response } from "express";
import { generateEmbedding } from "../lib/embeddings/ollamaEmbeddings";
import { hybridSearch } from "../lib/search/hybridSearch";
import { rerank } from "../lib/reranker/rerankerClient";
import { withWorkspace } from "../db/withWorkspace";

const CANDIDATE_POOL_SIZE = 20;
const FINAL_TOP_K = 5;

export async function rerankedQueryWorkspace(req: Request, res: Response) {
	const { workspaceId } = req.params;
	const { question, chunkingStrategy } = req.body;

	if (!workspaceId || Array.isArray(workspaceId)) {
		return res.status(400).json({ error: "workspaceId is required" });
	}
	if (!question || typeof question !== "string") {
		return res.status(400).json({ error: "question is required" });
	}
	const strategy =
		chunkingStrategy === "structure_aware" ? "structure_aware" : "fixed";

	try {
		const queryEmbedding = await generateEmbedding(question);

		const candidates = await withWorkspace(workspaceId, (tx) =>
			hybridSearch(
				tx,
				workspaceId,
				question,
				queryEmbedding,
				strategy,
				CANDIDATE_POOL_SIZE,
			),
		);

		const reranked = await rerank(
			question,
			candidates.map((c) => ({ id: c.id, content: c.content })),
			FINAL_TOP_K,
		);

		// Re-attach full chunk content, since the reranker only returns id+score
		const contentById = new Map(candidates.map((c) => [c.id, c]));
		const results = reranked.map((r) => ({
			...contentById.get(r.id),
			rerankScore: r.score,
		}));

		return res.status(200).json({ question, strategy, results });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "internal server error" });
	}
}
