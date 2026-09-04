import { Router } from "express";
import {
  getInterview,
  listMyInterviews,
  addPanelist,
  removePanelist,
  createInterviewSlot,
  addCandidatesToSlot,
  listInterviewSlots,
  getInterviewSlotDetail,
} from "../controllers/interview.controller.js";
import { sendFeedbackReminder, sendCandidateInvite, sendPanelistInterviewInvite } from "../controllers/followUp.controller.js";
import {
  submitFeedback,
  listFeedbackForInterview,
} from "../controllers/feedback.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const interviewRouter = Router();

interviewRouter.use(requireAuth);

interviewRouter.get("/mine", listMyInterviews);
// New primitives for the HR Interviews calendar module (task #30) --
// schedule a time/panel/round slot with no candidates yet, then add one or
// more candidates to it separately, matching the wireframe's split "+" menu.
// GET "/" and "/slots/:slotId" must come before GET "/:id" -- Express
// matches by segment count so "/slots/5" (2 segments) never conflicts with
// "/:id" (1 segment), but a bare "/" listing route needs to be its own thing
// since "/:id" only matches when a segment is actually present.
interviewRouter.get("/", listInterviewSlots);
interviewRouter.post("/", requireRole(Role.HR), createInterviewSlot);
interviewRouter.get("/slots/:slotId", getInterviewSlotDetail);
interviewRouter.post("/:id/candidates", requireRole(Role.HR), addCandidatesToSlot);
interviewRouter.get("/:id", getInterview);

interviewRouter.post("/:id/panelists", requireRole(Role.HR), addPanelist);
interviewRouter.delete("/:id/panelists/:userId", requireRole(Role.HR), removePanelist);
interviewRouter.post("/:id/panelists/:userId/remind", requireRole(Role.HR), sendFeedbackReminder);
interviewRouter.post("/:id/candidate/remind", requireRole(Role.HR), sendCandidateInvite);
interviewRouter.post("/:id/panelists/:userId/invite", requireRole(Role.HR), sendPanelistInterviewInvite);

interviewRouter.get("/:id/feedback", listFeedbackForInterview);
// Corrections doc: Management attends the final interview round and needs
// to be able to submit feedback too, same as INTERVIEWER.
interviewRouter.post("/:id/feedback", requireRole(Role.INTERVIEWER, Role.MANAGEMENT, Role.HIRING_MANAGER), submitFeedback);
