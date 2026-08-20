import { Router } from "express";
import { getApplication, updateApplicationStatus } from "../controllers/application.controller.js";
import { scheduleInterview, listInterviewsForApplication } from "../controllers/interview.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const applicationRouter = Router();

applicationRouter.use(requireAuth);

applicationRouter.get("/:id", getApplication);
applicationRouter.patch("/:id/status", requireRole(Role.HR, Role.INTERVIEWER), updateApplicationStatus);

applicationRouter.get("/:id/interviews", listInterviewsForApplication);
applicationRouter.post("/:id/interviews", requireRole(Role.HR), scheduleInterview);
