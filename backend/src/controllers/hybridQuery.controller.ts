import type { Request, Response } from "express";
import { generateEmbedding } from "../lib/embeddings/ollamaEmbeddings";
import { hybridSearch } from "../lib/search/hybridSearch";
import { withWorkspace } from "../db/withWorkspace";

const TOP_K = 5;

export async function hybridQueryWorkspace(req: Request, res: Response) {
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

		const results = await withWorkspace(workspaceId, (tx) =>
			hybridSearch(
				tx,
				workspaceId,
				question,
				queryEmbedding,
				strategy,
				TOP_K,
			),
		);

		return res.status(200).json({ question, strategy, results });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "internal server error" });
	}
}
