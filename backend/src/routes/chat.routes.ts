import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requireWorkspaceOwnership } from "../middleware/workspaceOwnership.middleware";
import { chatWithWorkspace } from "../controllers/chat.controller";

const router = Router({ mergeParams: true });

router.post("/", requireAuth, requireWorkspaceOwnership, chatWithWorkspace);

export default router;