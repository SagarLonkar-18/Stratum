import type { Request, Response } from "express";
import { withWorkspace } from "../db/withWorkspace";

export async function listConversations(req: Request, res: Response) {
	const { workspaceId } = req.params;

	if (!workspaceId || Array.isArray(workspaceId)) {
		return res.status(400).json({ error: "workspaceId is required" });
	}

	try {
		const conversations = await withWorkspace(workspaceId, (tx) =>
			tx.conversation.findMany({
				where: { workspaceId },
				orderBy: { createdAt: "desc" },
			}),
		);
		return res.status(200).json(conversations);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "internal server error" });
	}
}

export async function getConversation(req: Request, res: Response) {
	const { workspaceId, conversationId } = req.params;

	if (!workspaceId || Array.isArray(workspaceId)) {
		return res.status(400).json({ error: "workspaceId is required" });
	}
	if (!conversationId || Array.isArray(conversationId)) {
		return res.status(400).json({ error: "conversationId is required" });
	}

	try {
		const conversation = await withWorkspace(workspaceId, (tx) =>
			tx.conversation.findUnique({
				where: { id: conversationId },
				include: { messages: { orderBy: { createdAt: "asc" } } },
			}),
		);

		if (!conversation) {
			return res.status(404).json({ error: "conversation not found" });
		}

		return res.status(200).json(conversation);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "internal server error" });
	}
}
