import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { prisma } from "../prisma.js";
import { signToken } from "../utils/jwt.js";
import { sendEmail } from "../utils/mailer.js";
import { Role } from "../../generated/prisma/index.js";

const GENERIC_ERROR = "Invalid email or password";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email }, omit: { passwordHash: false } });
  if (!user) {
    return res.status(401).json({ error: GENERIC_ERROR });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ error: GENERIC_ERROR });
  }

  if (!user.isActive) {
    return res.status(401).json({ error: GENERIC_ERROR });
  }

  if (user.role === Role.IT_ADMIN) {
    return res.status(401).json({ error: GENERIC_ERROR });
  }

  const token = signToken({ id: user.id, role: user.role, department: user.department });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department },
  });
}

export async function adminLogin(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email }, omit: { passwordHash: false } });
  if (!user) {
    return res.status(401).json({ error: GENERIC_ERROR });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ error: GENERIC_ERROR });
  }

  if (!user.isActive) {
    return res.status(401).json({ error: GENERIC_ERROR });
  }

  if (user.role !== Role.IT_ADMIN) {
    return res.status(401).json({ error: GENERIC_ERROR });
  }

  const token = signToken({ id: user.id, role: user.role, department: user.department });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department },
  });
}

export async function me(req: Request, res: Response) {
  res.json({ user: req.user });
}

const GENERIC_RESET_MESSAGE = "If that email exists, a password reset link has been sent.";

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body as { email?: string };
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Always respond the same way whether or not the email exists, so this
  // endpoint can't be used to find out who has an account.
  if (!user || !user.isActive) {
    return res.json({ message: GENERIC_RESET_MESSAGE });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = hashToken(rawToken);
  const resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetTokenHash, resetTokenExpiresAt },
  });

  const resetLink = `http://localhost:5173/reset-password?token=${rawToken}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your Recruitment Tracker password",
    body: `Hi ${user.name},\n\nUse this link to reset your password (expires in 1 hour):\n${resetLink}\n\nIf you didn't request this, you can ignore this email.`,
  });

  res.json({ message: GENERIC_RESET_MESSAGE });
}

export async function resetPassword(req: Request, res: Response) {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };
  if (!token || !newPassword) {
    return res.status(400).json({ error: "token and newPassword are required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const resetTokenHash = hashToken(token);
  const user = await prisma.user.findFirst({
    where: { resetTokenHash },
    omit: { resetTokenExpiresAt: false },
  });

  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    return res.status(400).json({ error: "Invalid or expired reset link" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetTokenHash: null, resetTokenExpiresAt: null },
  });

  res.json({ message: "Password has been reset. You can now log in with your new password." });
}