import { Router } from "express";
import {
  createVacancy,
  listVacancies,
  getVacancy,
  updateVacancy,
  assignInterviewerToVacancy,
  removeInterviewerFromVacancy,
  listVacancyInterviewers,
  listVacancyStages,
  createVacancyStage,
  updateVacancyStage,
  deleteVacancyStage,
  reorderVacancyStages,
} from "../controllers/vacancy.controller.js";
import { createInterviewPanel, listInterviewPanelsForVacancy } from "../controllers/interviewPanel.controller.js";
import {
  applyCandidateToVacancy,
  listApplicationsForVacancy,
  compareApplicationsForVacancy,
} from "../controllers/application.controller.js";
import { listFeedbackForVacancy } from "../controllers/feedback.controller.js";
import { getVacancyReport, getVacancyReportPdf } from "../controllers/reports.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const vacancyRouter = Router();

vacancyRouter.use(requireAuth);

vacancyRouter.get("/", listVacancies);
vacancyRouter.get("/:id", getVacancy);

vacancyRouter.post("/", requireRole(Role.HR), createVacancy);
vacancyRouter.patch("/:id", requireRole(Role.HR), updateVacancy);

vacancyRouter.get("/:id/interviewers", listVacancyInterviewers);
vacancyRouter.post("/:id/interviewers", requireRole(Role.HR), assignInterviewerToVacancy);
vacancyRouter.delete("/:id/interviewers/:userId", requireRole(Role.HR), removeInterviewerFromVacancy);

// Named, reusable panels -- a saved grouping within a vacancy's interviewer
// pool above (see schema.prisma comment on InterviewPanel).
vacancyRouter.get("/:id/panels", listInterviewPanelsForVacancy);
vacancyRouter.post("/:id/panels", requireRole(Role.HR), createInterviewPanel);

// US-05: HR-configurable interview rounds. Reorder route must come before
// "/:stageId" -- otherwise Express would match "reorder" as a :stageId value.
vacancyRouter.get("/:id/stages", listVacancyStages);
vacancyRouter.post("/:id/stages", requireRole(Role.HR), createVacancyStage);
vacancyRouter.patch("/:id/stages/reorder", requireRole(Role.HR), reorderVacancyStages);
vacancyRouter.patch("/:id/stages/:stageId", requireRole(Role.HR), updateVacancyStage);
vacancyRouter.delete("/:id/stages/:stageId", requireRole(Role.HR), deleteVacancyStage);

vacancyRouter.get("/:id/applications", listApplicationsForVacancy);
vacancyRouter.post("/:id/applications", requireRole(Role.HR), applyCandidateToVacancy);

vacancyRouter.get("/:id/feedback", listFeedbackForVacancy);
vacancyRouter.get("/:id/comparison", compareApplicationsForVacancy);
vacancyRouter.get("/:id/report", getVacancyReport);
vacancyRouter.get("/:id/report/pdf", getVacancyReportPdf);
