import { Router } from "express";
import { getSystemMetrics } from "../controllers/system.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const systemRouter = Router();

systemRouter.use(requireAuth);

systemRouter.get("/metrics", requireRole(Role.IT_ADMIN), getSystemMetrics);
