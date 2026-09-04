import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { prisma } from "../prisma.js";
import { signToken } from "../utils/jwt.js";
import { sendEmail } from "../utils/mailer.js";
import { renderTemplate } from "../utils/notificationTemplates.js";
import { Role } from "../../generated/prisma/index.js";

const GENERIC_ERROR = "Invalid email or password";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Bug fix: this whole file had no try/catch anywhere, unlike every other
// controller in the codebase (all of which catch DB/bcrypt errors and return
// a proper JSON 500). If prisma.user.findUnique/bcrypt.compare ever threw
// here -- a dropped DB connection, a connection-pool hiccup, a dev-server
// restart mid-request -- Express had nothing to catch it, so the connection
// could be torn down without ever sending a body. The frontend's postLogin
// (api/auth.ts) then hit `res.json()` on an empty response and threw
// "Failed to execute 'json' on 'Response': Unexpected end of JSON input"
// straight onto the login screen -- a real, reproducible failure mode, not
// just a one-off network blip. Wrapping every handler here the same way the
// rest of the codebase already does closes this off structurally.
export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not log in right now. Please try again." });
  }
}

export async function adminLogin(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not log in right now. Please try again." });
  }
}

export async function me(req: Request, res: Response) {
  res.json({ user: req.user });
}

// Re-confirms the *caller's own* password mid-session -- not a login, no
// token issued. Used wherever a screen wants a "type your password to
// confirm" step for a sensitive action (IT Admin deactivating an account,
// IT Admin creating a new account) without re-doing the whole login flow.
// Deliberately generic (any authenticated role) rather than IT-Admin-only,
// since the pattern itself isn't role-specific even though today's only
// callers are IT Admin screens.
export async function verifyPassword(req: Request, res: Response) {
  const { password } = req.body as { password?: string };
  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, omit: { passwordHash: false } });
    if (!user) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    res.json({ verified: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not verify password right now. Please try again." });
  }
}

const GENERIC_RESET_MESSAGE = "If that email exists, a password reset link has been sent.";

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body as { email?: string };
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
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

    // Was hardcoded to localhost:5173. That's correct for local dev (Vite
    // serves the frontend there, proxying /api to this backend on :4000), but
    // breaks the moment this is deployed -- production serves frontend+backend
    // from this same Express process on one shared origin (see app.ts), which
    // is NOT localhost:5173. Deriving from the request's own host would break
    // local dev instead (the request arrives on :4000, not :5173) -- so this
    // needs an explicit override, not an auto-detect. Set FRONTEND_URL in
    // production (e.g. the Render URL from docs/cloud-deployment-guide.md);
    // local dev is unaffected since it's unset there.
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetLink = `${baseUrl}/reset-password?token=${rawToken}`;
    // Real SMTP delivery can fail (bad credentials, provider outage) in a way
    // the old console-log stub never could. This endpoint must always respond
    // identically whether or not the account exists (see comment above), so a
    // send failure here can't be allowed to produce a different response --
    // log it and continue exactly as if the email had gone out.
    try {
      const { subject, body } = await renderTemplate("auth_password_reset", {
        userName: user.name,
        resetLink,
      });
      await sendEmail({ to: user.email, subject, body });
    } catch (emailErr) {
      console.error("Password reset token generated but email failed to send:", emailErr);
    }

    res.json({ message: GENERIC_RESET_MESSAGE });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not process that request right now. Please try again." });
  }
}

export async function resetPassword(req: Request, res: Response) {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };
  if (!token || !newPassword) {
    return res.status(400).json({ error: "token and newPassword are required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not reset password right now. Please try again." });
  }
}