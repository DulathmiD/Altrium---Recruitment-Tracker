import { Router } from "express";
import { listAuditLogs, listAuditEventTypes } from "../controllers/auditLog.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const auditLogRouter = Router();

auditLogRouter.use(requireAuth);

auditLogRouter.get("/", requireRole(Role.IT_ADMIN), listAuditLogs);
auditLogRouter.get("/event-types", requireRole(Role.IT_ADMIN), listAuditEventTypes);
