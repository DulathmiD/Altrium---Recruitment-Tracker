import { Router } from "express";
import {
  getInterview,
  listMyInterviews,
  addPanelist,
  removePanelist,
} from "../controllers/interview.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const interviewRouter = Router();

interviewRouter.use(requireAuth);

interviewRouter.get("/mine", listMyInterviews);
interviewRouter.get("/:id", getInterview);

interviewRouter.post("/:id/panelists", requireRole(Role.HR), addPanelist);
interviewRouter.delete("/:id/panelists/:userId", requireRole(Role.HR), removePanelist);
