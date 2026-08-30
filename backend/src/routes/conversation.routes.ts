import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requireWorkspaceOwnership } from "../middleware/workspaceOwnership.middleware";
import { listConversations, getConversation } from "../controllers/conversation.controller";

const router = Router({ mergeParams: true });

router.get("/", requireAuth, requireWorkspaceOwnership, listConversations);
router.get("/:conversationId", requireAuth, requireWorkspaceOwnership, getConversation);

export default router;