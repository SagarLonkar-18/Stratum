import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requireWorkspaceOwnership } from "../middleware/workspaceOwnership.middleware";
import { createWorkspace, getWorkspace, listWorkspaces } from "../controllers/workspace.controller";

const router = Router();

router.post("/", requireAuth, createWorkspace);
router.get("/", requireAuth, listWorkspaces);
router.get("/:workspaceId", requireAuth, requireWorkspaceOwnership, getWorkspace);

export default router;