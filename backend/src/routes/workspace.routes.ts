import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { createWorkspace } from "../controllers/workspace.controller";

const router = Router();

router.post("/", requireAuth, createWorkspace);

export default router;