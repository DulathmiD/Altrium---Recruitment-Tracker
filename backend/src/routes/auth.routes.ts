import { Router } from "express";
import { login, adminLogin, me } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/admin-login", adminLogin);
authRouter.get("/me", requireAuth, me);