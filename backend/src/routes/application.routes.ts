import { Router } from "express";
import {
  getApplication,
  updateApplicationStatus,
  recordHiringDecision,
  updateApplicationStage,
  assignHiringManager,
  listApplicationsAssignedToMe,
} from "../controllers/application.controller.js";
import { scheduleInterview, listInterviewsForApplication } from "../controllers/interview.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const applicationRouter = Router();

applicationRouter.use(requireAuth);

// Must come before "/:id" -- otherwise Express matches "assigned-to-me" as an :id value.
applicationRouter.get("/assigned-to-me", requireRole(Role.HIRING_MANAGER), listApplicationsAssignedToMe);

applicationRouter.get("/:id", getApplication);
applicationRouter.patch("/:id/status", requireRole(Role.HR, Role.INTERVIEWER), updateApplicationStatus);
applicationRouter.patch("/:id/decision", requireRole(Role.HIRING_MANAGER), recordHiringDecision);
applicationRouter.patch("/:id/stage", requireRole(Role.INTERVIEWER, Role.HIRING_MANAGER), updateApplicationStage);
applicationRouter.patch("/:id/assign-hm", requireRole(Role.HR), assignHiringManager);

applicationRouter.get("/:id/interviews", listInterviewsForApplication);
applicationRouter.post("/:id/interviews", requireRole(Role.HR), scheduleInterview);
