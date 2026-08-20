import { Router } from "express";
import {
  createVacancy,
  listVacancies,
  getVacancy,
  updateVacancy,
  addStage,
  updateStage,
  deleteStage,
} from "../controllers/vacancy.controller.js";
import {
  applyCandidateToVacancy,
  listApplicationsForVacancy,
} from "../controllers/application.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const vacancyRouter = Router();

vacancyRouter.use(requireAuth);

vacancyRouter.get("/", listVacancies);
vacancyRouter.get("/:id", getVacancy);

vacancyRouter.post("/", requireRole(Role.HR), createVacancy);
vacancyRouter.patch("/:id", requireRole(Role.HR), updateVacancy);

vacancyRouter.post("/:id/stages", requireRole(Role.HR), addStage);
vacancyRouter.patch("/:id/stages/:stageId", requireRole(Role.HR), updateStage);
vacancyRouter.delete("/:id/stages/:stageId", requireRole(Role.HR), deleteStage);

vacancyRouter.get("/:id/applications", listApplicationsForVacancy);
vacancyRouter.post("/:id/applications", requireRole(Role.HR), applyCandidateToVacancy);
