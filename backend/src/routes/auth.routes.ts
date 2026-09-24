import { Router } from "express";
import { login, adminLogin, me, forgotPassword, resetPassword, verifyPassword, changePassword } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { loginRateLimit, passwordResetRateLimit } from "../middleware/rateLimit.middleware.js";

export const authRouter = Router();

authRouter.post("/login", loginRateLimit, login);
authRouter.post("/admin-login", loginRateLimit, adminLogin);
authRouter.get("/me", requireAuth, me);
authRouter.post("/forgot-password", passwordResetRateLimit, forgotPassword);
authRouter.post("/reset-password", passwordResetRateLimit, resetPassword);
authRouter.post("/verify-password", requireAuth, verifyPassword);
authRouter.post("/change-password", requireAuth, changePassword);