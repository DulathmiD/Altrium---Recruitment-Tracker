import { Router } from "express";
import {
  getApplication,
  updateApplicationStatus,
  recordHiringDecision,
  assignHiringManager,
  listApplicationsAssignedToMe,
  submitStageRecommendation,
  listRecommendationsForApplication,
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
applicationRouter.patch("/:id/assign-hm", requireRole(Role.HR), assignHiringManager);

// No standalone stage-update route. The Hiring Manager's recommendation is
// now binding (see application.controller.ts submitStageRecommendation) --
// ADVANCE/DO_NOT_PROGRESS is what moves the application through the
// interview stages. Neither HR nor the Interviewer has a separate action
// that mutates stage directly.
applicationRouter.post("/:id/recommendation", requireRole(Role.HIRING_MANAGER), submitStageRecommendation);
applicationRouter.get("/:id/recommendation", listRecommendationsForApplication);

applicationRouter.get("/:id/interviews", listInterviewsForApplication);
applicationRouter.post("/:id/interviews", requireRole(Role.HR), scheduleInterview);
