import { Router } from "express";
import { getFollowUps } from "../controllers/followUp.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const followUpRouter = Router();

followUpRouter.use(requireAuth);

// HR-only, per the locked US-26/US-29 interpretation -- Follow-ups is an
// HR-facing page, not a general-purpose one.
followUpRouter.get("/", requireRole(Role.HR), getFollowUps);
