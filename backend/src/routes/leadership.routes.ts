import { Router } from "express";
import {
  getLeadershipDashboard,
  listLeadershipDepartments,
  listLeadershipVacancies,
  getRecruitmentProgress,
  getDepartmentPerformance,
  getHiringTrends,
  listReports,
  getReportPdf,
} from "../controllers/leadership.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const leadershipRouter = Router();

leadershipRouter.use(requireAuth);
leadershipRouter.use(requireRole(Role.LEADERSHIP_MANAGEMENT));

leadershipRouter.get("/dashboard", getLeadershipDashboard);
leadershipRouter.get("/departments", listLeadershipDepartments);
leadershipRouter.get("/vacancies", listLeadershipVacancies);
leadershipRouter.get("/recruitment-progress", getRecruitmentProgress);
leadershipRouter.get("/department-performance", getDepartmentPerformance);
leadershipRouter.get("/hiring-trends", getHiringTrends);
leadershipRouter.get("/reports", listReports);
leadershipRouter.get("/reports/:type/pdf", getReportPdf);
