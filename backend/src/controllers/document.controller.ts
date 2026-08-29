import type { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { PDFParse } from "pdf-parse";
import { withWorkspace } from "../db/withWorkspace";
import { chunkTextFixedSize } from "../lib/chunking/fixedSizeChunker";
import { chunkTextStructureAware } from "../lib/chunking/structureAwareChunker";
import { generateEmbedding } from "../lib/embeddings/ollamaEmbeddings";

export async function uploadDocument(req: Request, res: Response) {
	const { workspaceId } = req.params;

	if (!workspaceId || Array.isArray(workspaceId)) {
		return res.status(400).json({ error: "workspaceId is required" });
	}

	if (!req.file) {
		return res.status(400).json({ error: "a file is required" });
	}

	try {
		const document = await withWorkspace(workspaceId, (tx) =>
			tx.document.create({
				data: {
					workspaceId,
					filename: req.file!.originalname,
					filePath: "", // placeholder, filled in below
					fileType: "pdf",
					status: "processing",
				},
			}),
		);

		const finalDir = path.join(process.cwd(), "uploads", workspaceId);
		await fs.mkdir(finalDir, { recursive: true });

		const finalPath = path.join(
			finalDir,
			`${document.id}-${req.file.originalname}`,
		);
		await fs.rename(req.file.path, finalPath);

		const relativePath = path.relative(process.cwd(), finalPath);

		const fileBuffer = await fs.readFile(finalPath);
		const parser = new PDFParse({ data: fileBuffer });
		const result = await parser.getText();
		await parser.destroy();

		console.log("\n--- Extracted PDF text (first 500 chars) ---");
		console.log(result.text.slice(0, 500));
		console.log("--- End preview ---");
		console.log(`Total extracted characters: ${result.text.length}`);
		console.log(`Reported page count: ${result.total}\n`);

		const strategies = [
			{ name: "fixed" as const, chunks: chunkTextFixedSize(result.text) },
			{
				name: "structure_aware" as const,
				chunks: chunkTextStructureAware(result.text),
			},
		];

		for (const strategy of strategies) {
			console.log(
				`Generated ${strategy.chunks.length} chunks (${strategy.name} strategy)`,
			);

			// Step 1: embed every chunk OUTSIDE any database transaction, since
			// embedding is a slow external network call with no DB dependency.
			// Holding a transaction open across dozens of sequential network
			// calls risks exceeding Prisma's interactive transaction timeout.
			const embeddedChunks: {
				chunk: (typeof strategy.chunks)[number];
				embedding: number[];
			}[] = [];
			for (const chunk of strategy.chunks) {
				const embedding = await generateEmbedding(chunk.content);
				embeddedChunks.push({ chunk, embedding });
				console.log(
					`  [${strategy.name}] Embedded chunk ${chunk.chunkIndex} (${embedding.length} dims)`,
				);
			}

			// Step 2: now that all embeddings are ready, write everything to the
			// database inside one short-lived transaction — only fast DB writes
			// happen here, so this stays well within the timeout regardless of
			// how many chunks there are.
			await withWorkspace(workspaceId, async (tx) => {
				for (const { chunk, embedding } of embeddedChunks) {
					const created = await tx.chunk.create({
						data: {
							documentId: document.id,
							workspaceId,
							content: chunk.content,
							chunkIndex: chunk.chunkIndex,
							tokenCount: Math.round(chunk.content.length / 4),
							chunkingStrategy: strategy.name,
						},
					});

					const vectorLiteral = `[${embedding.join(",")}]`;
					await tx.$executeRawUnsafe(
						`UPDATE "Chunk" SET embedding = $1::vector WHERE id = $2`,
						vectorLiteral,
						created.id,
					);
				}
			});
		}

		console.log("");

		const updated = await withWorkspace(workspaceId, (tx) =>
			tx.document.update({
				where: { id: document.id },
				data: { filePath: relativePath, status: "ready" },
			}),
		);

		return res.status(201).json(updated);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "internal server error" });
	}
}

export async function listDocuments(req: Request, res: Response) {
	const { workspaceId } = req.params;

	if (!workspaceId || Array.isArray(workspaceId)) {
		return res.status(400).json({ error: "workspaceId is required" });
	}

	try {
		const documents = await withWorkspace(workspaceId, (tx) =>
			tx.document.findMany({
				where: { workspaceId },
				orderBy: { uploadedAt: "desc" },
			}),
		);
		return res.status(200).json(documents);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "internal server error" });
	}
}
