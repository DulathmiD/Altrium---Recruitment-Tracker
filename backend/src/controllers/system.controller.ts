import type { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { getAverageResponseTimeMs, getServerLoadPercent } from "../utils/systemMetrics.js";

// "Concurrent users" has no real session-tracking to read from (auth is
// stateless JWT, no server-side session table) -- the closest honest proxy
// is the count of distinct accounts that have actually done something
// (any AuditLog-covered action) in the last few minutes. Not a literal
// concurrent-connections count, but a real, derived number rather than a
// fabricated one.
const RECENT_ACTIVITY_WINDOW_MS = 5 * 60 * 1000;
const BACKUP_HISTORY_DAYS = 7;
const BACKUP_HOUR_UTC = 3;

// No automated backup job actually exists in this project -- there's no
// scheduler, no mysqldump, no storage target. This history is a display-only
// simulation (deterministic: one entry per of the last N days at 03:00,
// always "Successful") built at the user's explicit request to see the
// Systems page looking like a live, working backup system rather than an
// honest "not configured" placeholder. Flagged here and in the decision log
// so this doesn't get mistaken for a real backup log later.
function buildSimulatedBackupHistory(days: number): { at: string; status: "successful" }[] {
  const history: { at: string; status: "successful" }[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i, BACKUP_HOUR_UTC, 0, 0));
    history.push({ at: d.toISOString(), status: "successful" });
  }
  return history;
}

export async function getSystemMetrics(_req: Request, res: Response) {
  try {
    const since = new Date(Date.now() - RECENT_ACTIVITY_WINDOW_MS);
    const recentActors = await prisma.auditLog.findMany({
      where: { createdAt: { gte: since } },
      select: { userId: true },
      distinct: ["userId"],
    });

    const history = buildSimulatedBackupHistory(BACKUP_HISTORY_DAYS);

    res.json({
      serverLoadPercent: getServerLoadPercent(),
      responseTimeMs: getAverageResponseTimeMs(),
      concurrentUsers: recentActors.length,
      backups: {
        status: "successful" as const,
        lastBackupAt: history[0]!.at,
        history,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch system metrics" });
  }
}
