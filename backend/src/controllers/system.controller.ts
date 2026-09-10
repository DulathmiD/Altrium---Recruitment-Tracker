import type { Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../prisma.js";
import { getAverageResponseTimeMs, getServerLoadPercent } from "../utils/systemMetrics.js";
import { runBackupNow } from "../jobs/backupJob.js";

// "Concurrent users" has no real session-tracking to read from (auth is
// stateless JWT, no server-side session table) -- the closest honest proxy
// is the count of distinct accounts that have actually done something
// (any AuditLog-covered action) in the last few minutes. Not a literal
// concurrent-connections count, but a real, derived number rather than a
// fabricated one.
const RECENT_ACTIVITY_WINDOW_MS = 5 * 60 * 1000;
const BACKUP_HISTORY_LIMIT = 14;

// Separate, wider window/signal than RECENT_ACTIVITY_WINDOW_MS above --
// deliberately not merged into "Concurrent Users" (which only counts
// AuditLog-covered write actions in the last 5 minutes). This list is built
// off User.lastActiveAt (see its schema.prisma comment), which updates on
// EVERY authenticated request including plain reads, throttled to once per
// 60s per user. 10 minutes matches what this "active now" concept meant
// when it briefly lived on the Users page before moving here. The two
// numbers on this page (KPI count vs. this list's length) can legitimately
// differ -- that's expected, not a bug, since they measure different things.
const ACTIVE_USERS_WINDOW_MS = 10 * 60 * 1000;

// Real backup history, replacing the earlier simulated version -- lists the
// actual .sql files backupJob.ts's scheduled (or manually triggered)
// mysqldump writes to backend/backups/. A file existing on disk IS the
// success signal here; there's no separate success/failure log to read
// (a failed dump just doesn't produce a file, logged to the server console
// instead -- see backupJob.ts's runBackupNow()).
const BACKUP_DIR = path.join(process.cwd(), "backups");

function readBackupHistory(limit: number): { at: string; status: "successful"; filename: string; sizeBytes: number }[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".sql"));
  } catch {
    return []; // directory doesn't exist yet -- no backup has ever run
  }
  return entries
    .map((filename) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, filename));
      return { at: stat.mtime.toISOString(), status: "successful" as const, filename, sizeBytes: stat.size };
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

export async function getSystemMetrics(_req: Request, res: Response) {
  try {
    const since = new Date(Date.now() - RECENT_ACTIVITY_WINDOW_MS);
    const recentActors = await prisma.auditLog.findMany({
      where: { createdAt: { gte: since } },
      select: { userId: true },
      distinct: ["userId"],
    });

    const activeSince = new Date(Date.now() - ACTIVE_USERS_WINDOW_MS);
    const activeUsers = await prisma.user.findMany({
      where: { lastActiveAt: { gte: activeSince } },
      select: { id: true, name: true, email: true, role: true, lastActiveAt: true },
      orderBy: { lastActiveAt: "desc" },
    });

    const history = readBackupHistory(BACKUP_HISTORY_LIMIT);

    res.json({
      serverLoadPercent: getServerLoadPercent(),
      responseTimeMs: getAverageResponseTimeMs(),
      concurrentUsers: recentActors.length,
      activeUsers,
      backups: {
        status: history.length > 0 ? ("successful" as const) : ("not_configured" as const),
        lastBackupAt: history[0]?.at ?? null,
        history,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch system metrics" });
  }
}

// Manual trigger, mainly so a real backup can be demonstrated on demand
// (the scheduled job only fires at 03:00 -- not useful to point at live).
// Runs the exact same mysqldump backupJob.ts's cron uses, just invoked
// directly instead of waiting for the schedule.
export async function runBackupNowEndpoint(req: Request, res: Response) {
  // Audit logging happens inside runBackupNow() itself now (it needs to
  // attribute scheduled 3am runs to something too, since there's no human
  // actor then) -- passing the real logged-in user here just means a manual
  // click gets attributed to who actually clicked it, instead of falling
  // back to "first IT_ADMIN found".
  const result = await runBackupNow({ actorUserId: req.user!.id, trigger: "manual" });
  if (!result.ok) {
    return res.status(500).json({ error: result.error || "Backup failed" });
  }
  res.json({ ok: true, filename: result.file });
}
