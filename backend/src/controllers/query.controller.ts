import type { Request, Response } from "express";
import { generateEmbedding } from "../lib/embeddings/ollamaEmbeddings";
import { withWorkspace } from "../db/withWorkspace";

const TOP_K = 5;

export async function queryWorkspace(req: Request, res: Response) {
    const { workspaceId } = req.params;
    const { question } = req.body;

    if (!workspaceId || Array.isArray(workspaceId)) {
        return res.status(400).json({ error: "workspaceId is required" });
    }
    if (!question || typeof question !== "string") {
        return res.status(400).json({ error: "question is required" });
    }

    try {
        const queryEmbedding = await generateEmbedding(question);
        const vectorLiteral = `[${queryEmbedding.join(",")}]`;

        const results = await withWorkspace(workspaceId, (tx) =>
        tx.$queryRawUnsafe<
            { id: string; content: string; chunkIndex: number; distance: number }[]
        >(
            `SELECT id, content, "chunkIndex", embedding <=> $1::vector AS distance
            FROM "Chunk"
            WHERE "workspaceId" = $2
            ORDER BY distance ASC
            LIMIT $3`,
            vectorLiteral,
            workspaceId,
            TOP_K
        )
        );

        return res.status(200).json({ question, results });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "internal server error" });
    }
}