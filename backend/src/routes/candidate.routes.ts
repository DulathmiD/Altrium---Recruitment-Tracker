import { Router } from "express";
import multer from "multer";
import {
  listCandidates,
  getCandidate,
  updateCandidate,
  extractCvFiles,
  confirmCvUpload,
  downloadCv,
} from "../controllers/candidate.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

// The old JSON single-candidate and CSV bulk-upload endpoints were retired
// this session -- real PDF upload (cv-extract -> cv-confirm) is now the only
// way candidates get created, matching what US-06/US-07 actually specify.
const uploadCv = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 20 } });

export const candidateRouter = Router();

candidateRouter.use(requireAuth);

candidateRouter.get("/", listCandidates);
candidateRouter.get("/:id", getCandidate);
candidateRouter.get("/:id/cv", downloadCv);

candidateRouter.post("/cv-extract", requireRole(Role.HR), uploadCv.array("files"), extractCvFiles);
candidateRouter.post("/cv-confirm", requireRole(Role.HR), confirmCvUpload);
candidateRouter.patch("/:id", requireRole(Role.HR), updateCandidate);
