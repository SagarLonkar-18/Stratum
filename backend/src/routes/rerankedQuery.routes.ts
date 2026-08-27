import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requireWorkspaceOwnership } from "../middleware/workspaceOwnership.middleware";
import { rerankedQueryWorkspace } from "../controllers/rerankedQuery.controller";

const router = Router({ mergeParams: true });

router.post("/", requireAuth, requireWorkspaceOwnership, rerankedQueryWorkspace);

export default router;