import { Router } from "express";
import { updateFeedback, listFeedbackAuditLog } from "../controllers/feedback.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const feedbackRouter = Router();

feedbackRouter.use(requireAuth);

feedbackRouter.patch("/:id", requireRole(Role.INTERVIEWER), updateFeedback);
feedbackRouter.get("/:id/audit-log", listFeedbackAuditLog);
