import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.js";
import { prisma } from "../prisma.js";

// Backs the "active now" indicator on IT Admin's Users page -- see
// schema.prisma's comment on User.lastActiveAt for why this is only an
// approximation, not a real session registry. In-memory per-user throttle
// (userId -> last-written epoch ms) so a user clicking around doesn't write
// to the DB on every single request; one write per user per minute is
// already far more granular than the "active in the last ~10 minutes" window
// this feeds. Fine to reset on server restart -- worst case is one extra
// write per active user right after a restart, not a correctness issue.
const LAST_ACTIVE_WRITE_INTERVAL_MS = 60 * 1000;
const lastWrittenAt = new Map<number, number>();

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = header.slice("Bearer ".length);

  try {
    req.user = verifyToken(token);

    // Best-effort, never blocks or fails the request -- same contract as
    // notifyUser()/writeAuditLog() elsewhere in this codebase. Own try/catch
    // (not just relying on the outer one) so that even a synchronous failure
    // here can never surface as a false 401 on an otherwise-valid token.
    // Runs regardless of what a later requireRole check decides -- an
    // authenticated request is "activity" even if it ends in a 403.
    try {
      const userId = req.user.id;
      const now = Date.now();
      const last = lastWrittenAt.get(userId) ?? 0;
      if (now - last > LAST_ACTIVE_WRITE_INTERVAL_MS) {
        lastWrittenAt.set(userId, now);
        prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date(now) } }).catch((err) => {
          console.error(`Could not update lastActiveAt for user ${userId}:`, err);
        });
      }
    } catch (err) {
      console.error("lastActiveAt tracking failed:", err);
    }

    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
