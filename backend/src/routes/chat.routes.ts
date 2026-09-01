import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requireWorkspaceOwnership } from "../middleware/workspaceOwnership.middleware";
import { chatWithWorkspace, chatWithWorkspaceStream } from "../controllers/chat.controller";

const router = Router({ mergeParams: true });

router.post("/", requireAuth, requireWorkspaceOwnership, chatWithWorkspace);
router.post("/stream", requireAuth, requireWorkspaceOwnership, chatWithWorkspaceStream);

export default router;