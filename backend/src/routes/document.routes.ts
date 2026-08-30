import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requireWorkspaceOwnership } from "../middleware/workspaceOwnership.middleware";
import { upload } from "../middleware/upload.middleware";
import { listDocuments, uploadDocument, deleteDocument } from "../controllers/document.controller";

const router = Router({ mergeParams: true });

router.post("/", requireAuth, requireWorkspaceOwnership, upload.single("file"), uploadDocument);
router.get("/", requireAuth, requireWorkspaceOwnership, listDocuments);
router.delete("/:documentId", requireAuth, requireWorkspaceOwnership, deleteDocument);

export default router;