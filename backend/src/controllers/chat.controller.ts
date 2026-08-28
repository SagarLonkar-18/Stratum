import type { Request, Response } from "express";
import { generateEmbedding } from "../lib/embeddings/ollamaEmbeddings";
import { generateCompletion } from "../lib/llm/ollamaCompletion";
import { hybridSearch } from "../lib/search/hybridSearch";
import { rerank } from "../lib/reranker/rerankerClient";
import { withWorkspace } from "../db/withWorkspace";

const CANDIDATE_POOL_SIZE = 20;
const FINAL_TOP_K = 5;

function buildPrompt(
	question: string,
	chunks: { id: string; content: string }[],
): string {
	const context = chunks
		.map(
			(c, i) =>
				`=== CHUNK ${i + 1} ===\n${c.content}\n=== END CHUNK ${i + 1} ===`,
		)
		.join("\n\n");

	return `You are answering questions using ONLY the numbered chunks below.

${context}

Question: ${question}

Instructions:
- Before answering, silently verify which chunk actually contains the specific fact — do not describe this verification process in your answer.
- Answer using only the information in the chunks above, in a natural, direct tone.
- After each claim, cite the exact chunk number where that specific fact appears, like [chunk 2].
- Do not explain your reasoning, do not say things like "this is found in chunk X" or "let me verify" — just state the answer with the citation.
- If the chunks don't contain the answer, say so clearly and directly, without narrating your reasoning process.

Answer:`;
}

export async function chatWithWorkspace(req: Request, res: Response) {
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

		const contentById = new Map(candidates.map((c) => [c.id, c]));
		const topChunks = reranked.map((r) => contentById.get(r.id)!);

		const prompt = buildPrompt(question, topChunks);
		const answer = await generateCompletion(prompt);

		return res.status(200).json({
			question,
			answer,
			sources: topChunks.map((c, i) => ({
				chunkNumber: i + 1,
				id: c.id,
				chunkIndex: c.chunkIndex,
				content: c.content,
			})),
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "internal server error" });
	}
}
