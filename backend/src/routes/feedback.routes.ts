import { Router } from "express";
import { updateFeedback, listFeedbackAuditLog } from "../controllers/feedback.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const feedbackRouter = Router();

feedbackRouter.use(requireAuth);

// Corrections doc: Management also needs to be able to add/edit feedback
// (they attend the final interview round) -- same as INTERVIEWER.
feedbackRouter.patch("/:id", requireRole(Role.INTERVIEWER, Role.MANAGEMENT, Role.HIRING_MANAGER), updateFeedback);
feedbackRouter.get("/:id/audit-log", listFeedbackAuditLog);
