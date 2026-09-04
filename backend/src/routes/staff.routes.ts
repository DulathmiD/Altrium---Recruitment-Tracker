import { Router } from "express";
import { listAssignableStaff } from "../controllers/staff.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const staffRouter = Router();

staffRouter.use(requireAuth);

// HR-only for now -- widen if/when another role needs to look up staff
// (e.g. a Hiring Manager screen wanting interviewer names).
staffRouter.get("/", requireRole(Role.HR), listAssignableStaff);
