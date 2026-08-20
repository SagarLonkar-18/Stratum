import type { Request, Response } from "express";
import { prisma } from "../db/client";

export async function createWorkspace(req: Request, res: Response) {
	const { name, type } = req.body;

	if (!name || !type) {
		return res.status(400).json({ error: "name and type are required" });
	}

	try {
		const workspace = await prisma.workspace.create({
			data: {
				name,
				type,
				ownerId: req.userId!, // set by requireAuth middleware
			},
		});

		return res.status(201).json(workspace);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "internal server error" });
	}
}

export async function getWorkspace(req: Request, res: Response) {
	const workspaceId = req.params.workspaceId;

	if (!workspaceId || Array.isArray(workspaceId)) {
		return res.status(400).json({ error: "workspaceId is required" });
	}

	const workspace = await prisma.workspace.findUnique({
		where: { id: workspaceId },
	});
	return res.status(200).json(workspace);
}

export async function listWorkspaces(req: Request, res: Response) {
	try {
		const workspaces = await prisma.workspace.findMany({
			where: { ownerId: req.userId },
			orderBy: { createdAt: "desc" },
		});
		return res.status(200).json(workspaces);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "internal server error" });
	}
}
