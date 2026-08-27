import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requireWorkspaceOwnership } from "../middleware/workspaceOwnership.middleware";
import { hybridQueryWorkspace } from "../controllers/hybridQuery.controller";

const router = Router({ mergeParams: true });

router.post("/", requireAuth, requireWorkspaceOwnership, hybridQueryWorkspace);

export default router;