import { Router } from "express";
import {
  createVacancy,
  listVacancies,
  getVacancy,
  updateVacancy,
  assignInterviewerToVacancy,
  removeInterviewerFromVacancy,
  listVacancyInterviewers,
} from "../controllers/vacancy.controller.js";
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

vacancyRouter.get("/:id/applications", listApplicationsForVacancy);
vacancyRouter.post("/:id/applications", requireRole(Role.HR), applyCandidateToVacancy);

vacancyRouter.get("/:id/feedback", listFeedbackForVacancy);
vacancyRouter.get("/:id/comparison", compareApplicationsForVacancy);
vacancyRouter.get("/:id/report", getVacancyReport);
vacancyRouter.get("/:id/report/pdf", getVacancyReportPdf);
