import type { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { PDFParse } from "pdf-parse";
import { withWorkspace } from "../db/withWorkspace";
import { chunkTextFixedSize } from "../lib/chunking/fixedSizeChunker";

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

		const chunks = chunkTextFixedSize(result.text);

		console.log(
			`Generated ${chunks.length} chunks (fixed-size strategy)\n`,
		);

		await withWorkspace(workspaceId, async (tx) => {
			for (const chunk of chunks) {
				await tx.chunk.create({
					data: {
						documentId: document.id,
						workspaceId,
						content: chunk.content,
						chunkIndex: chunk.chunkIndex,
						tokenCount: Math.round(chunk.content.length / 4), // rough approximation
						chunkingStrategy: "fixed",
					},
				});
			}
		});

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
