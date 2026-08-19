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
