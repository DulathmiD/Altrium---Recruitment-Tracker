import { Router } from "express";
import multer from "multer";
import {
  createCandidate,
  listCandidates,
  getCandidate,
  updateCandidate,
  bulkUploadCandidates,
} from "../controllers/candidate.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const candidateRouter = Router();

candidateRouter.use(requireAuth);

candidateRouter.get("/", listCandidates);
candidateRouter.get("/:id", getCandidate);

candidateRouter.post("/", requireRole(Role.HR), createCandidate);
candidateRouter.post("/bulk", requireRole(Role.HR), upload.single("file"), bulkUploadCandidates);
candidateRouter.patch("/:id", requireRole(Role.HR), updateCandidate);
