import { Router } from "express";
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  setUserActive,
  setUserRole,
} from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const userRouter = Router();

userRouter.use(requireAuth);
userRouter.use(requireRole(Role.IT_ADMIN));

userRouter.get("/", listUsers);
userRouter.get("/:id", getUser);
userRouter.post("/", createUser);
userRouter.patch("/:id", updateUser);
userRouter.patch("/:id/active", setUserActive);
userRouter.patch("/:id/role", setUserRole);
