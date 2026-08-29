import type { Request, Response } from "express";
import { prisma } from "../db/client";
import fs from "fs/promises";
import path from "path";

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

export async function updateWorkspace(req: Request, res: Response) {
	const workspaceId = req.params.workspaceId;
	const { name, type } = req.body;

	if (!workspaceId || Array.isArray(workspaceId)) {
		return res.status(400).json({ error: "workspaceId is required" });
	}
	if (!name && !type) {
		return res.status(400).json({ error: "name or type is required" });
	}

	try {
		const workspace = await prisma.workspace.update({
			where: { id: workspaceId },
			data: {
				...(name && { name }),
				...(type && { type }),
			},
		});
		return res.status(200).json(workspace);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "internal server error" });
	}
}

export async function deleteWorkspace(req: Request, res: Response) {
	const workspaceId = req.params.workspaceId;

	if (!workspaceId || Array.isArray(workspaceId)) {
		return res.status(400).json({ error: "workspaceId is required" });
	}

	try {
		await prisma.workspace.delete({ where: { id: workspaceId } });

		const uploadsDir = path.join(process.cwd(), "uploads", workspaceId);
		await fs.rm(uploadsDir, { recursive: true, force: true });

		return res.status(204).send();
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "internal server error" });
	}
}
