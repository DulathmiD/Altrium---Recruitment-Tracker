import { Router } from "express";
import {
  createCandidate,
  listCandidates,
  getCandidate,
  updateCandidate,
} from "../controllers/candidate.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const candidateRouter = Router();

candidateRouter.use(requireAuth);

candidateRouter.get("/", listCandidates);
candidateRouter.get("/:id", getCandidate);

candidateRouter.post("/", requireRole(Role.HR), createCandidate);
candidateRouter.patch("/:id", requireRole(Role.HR), updateCandidate);
