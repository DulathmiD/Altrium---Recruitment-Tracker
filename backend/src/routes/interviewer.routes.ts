import { Router } from "express";
import { listMyCandidates, listMyVacancyStages } from "../controllers/interviewer.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const interviewerRouter = Router();

interviewerRouter.use(requireAuth, requireRole(Role.INTERVIEWER));

interviewerRouter.get("/vacancy-stages", listMyVacancyStages);
interviewerRouter.get("/candidates", listMyCandidates);
