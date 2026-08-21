import type { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { withWorkspace } from "../db/withWorkspace";

export async function uploadDocument(req: Request, res: Response) {
	const { workspaceId } = req.params;

	if (!workspaceId || Array.isArray(workspaceId)) {
		return res.status(400).json({ error: "workspaceId is required" });
	}

	if (!req.file) {
		return res.status(400).json({ error: "a file is required" });
	}

	try {
		// Create the Document row first so we have a real ID to namespace
		// the final file path by.
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
