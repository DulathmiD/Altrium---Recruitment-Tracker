import { Router } from "express";
import {
  getManagementDashboard,
  getDepartmentVacanciesList,
  getCandidateProgress,
  getUpcomingInterviews,
  listReports,
  getReportPdf,
} from "../controllers/management.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const managementRouter = Router();

managementRouter.use(requireAuth);
managementRouter.use(requireRole(Role.MANAGEMENT));

managementRouter.get("/dashboard", getManagementDashboard);
managementRouter.get("/vacancies", getDepartmentVacanciesList);
managementRouter.get("/candidate-progress", getCandidateProgress);
managementRouter.get("/upcoming-interviews", getUpcomingInterviews);
managementRouter.get("/reports", listReports);
managementRouter.get("/reports/:type/pdf", getReportPdf);
