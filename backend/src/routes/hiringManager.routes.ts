import { Router } from "express";
import { getMyDashboard, getMyVacancies, getMyPendingDecisions, getMyDecisionHistory, getComparison, getVacancyCandidates, getApplicationForDecision } from "../controllers/hiringManager.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const hiringManagerRouter = Router();

hiringManagerRouter.use(requireAuth);
hiringManagerRouter.use(requireRole(Role.HIRING_MANAGER));

hiringManagerRouter.get("/dashboard", getMyDashboard);
hiringManagerRouter.get("/vacancies", getMyVacancies);
hiringManagerRouter.get("/pending-decisions", getMyPendingDecisions);
hiringManagerRouter.get("/decision-history", getMyDecisionHistory);
hiringManagerRouter.get("/vacancies/:vacancyId/comparison", getComparison);
hiringManagerRouter.get("/vacancies/:vacancyId/candidates", getVacancyCandidates);
hiringManagerRouter.get("/applications/:id/decision", getApplicationForDecision);
