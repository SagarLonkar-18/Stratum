import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requireWorkspaceOwnership } from "../middleware/workspaceOwnership.middleware";
import { listConversations, getConversation, updateConversation, deleteConversation } from "../controllers/conversation.controller";

const router = Router({ mergeParams: true });

router.get("/", requireAuth, requireWorkspaceOwnership, listConversations);
router.get("/:conversationId", requireAuth, requireWorkspaceOwnership, getConversation);
router.patch("/:conversationId", requireAuth, requireWorkspaceOwnership, updateConversation);
router.delete("/:conversationId", requireAuth, requireWorkspaceOwnership, deleteConversation);

export default router;