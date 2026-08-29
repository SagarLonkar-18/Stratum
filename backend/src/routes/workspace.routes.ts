import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requireWorkspaceOwnership } from "../middleware/workspaceOwnership.middleware";
import { createWorkspace, deleteWorkspace, getWorkspace, listWorkspaces, updateWorkspace } from "../controllers/workspace.controller";

const router = Router();

router.post("/", requireAuth, createWorkspace);
router.get("/", requireAuth, listWorkspaces);
router.get("/:workspaceId", requireAuth, requireWorkspaceOwnership, getWorkspace);
router.patch("/:workspaceId", requireAuth, requireWorkspaceOwnership, updateWorkspace);
router.delete("/:workspaceId", requireAuth, requireWorkspaceOwnership, deleteWorkspace);

export default router;