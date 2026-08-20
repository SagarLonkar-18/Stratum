import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/client";

export async function requireWorkspaceOwnership(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const workspaceId = req.params.workspaceId;

	if (!workspaceId || Array.isArray(workspaceId)) {
		return res.status(400).json({ error: "workspaceId is required" });
	}

	try {
		const workspace = await prisma.workspace.findUnique({
			where: { id: workspaceId },
		});

		if (!workspace) {
			return res.status(404).json({ error: "workspace not found" });
		}

		if (workspace.ownerId !== req.userId) {
			return res.status(404).json({ error: "workspace not found" });
		}

		next();
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "internal server error" });
	}
}
