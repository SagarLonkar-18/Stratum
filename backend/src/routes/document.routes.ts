import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requireWorkspaceOwnership } from "../middleware/workspaceOwnership.middleware";
import { upload } from "../middleware/upload.middleware";
import { uploadDocument } from "../controllers/document.controller";

const router = Router({ mergeParams: true });

router.post("/", requireAuth, requireWorkspaceOwnership, upload.single("file"), uploadDocument);

export default router;