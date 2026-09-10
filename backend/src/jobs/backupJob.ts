// Backlog item: "As an IT administrator, I want automatic system backups to
// prevent data loss." Previously entirely fake -- system.controller.ts's
// buildSimulatedBackupHistory() generated a deterministic "always
// Successful" history with no backup job, no mysqldump, and no storage
// target behind it at all (see that file's own comment, now stale and
// removed as part of this change). This replaces the simulation with a real
// scheduled `mysqldump` writing timestamped .sql files to backend/backups/,
// which system.controller.ts now lists for real instead of fabricating.
//
// Connection details are parsed from DATABASE_URL (already required for
// Prisma) rather than duplicating SMTP-style separate env vars -- one fewer
// thing to configure.
//
// Binary name: MySQL ships `mysqldump`; some newer MariaDB packages ship
// `mariadb-dump` instead (with `mysqldump` not present or only a
// compatibility symlink depending on the install). Defaults to `mysqldump`,
// overridable via BACKUP_DUMP_BIN if that's not what's on this machine's
// PATH -- not something this sandbox can detect, since it has no DB access
// to test against.
import cron from "node-cron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../prisma.js";
import { Role } from "../../generated/prisma/index.js";
import { writeAuditLog } from "../utils/auditLog.js";

const execFileAsync = promisify(execFile);

const CHECK_CRON = "0 3 * * *"; // once a day, 03:00 server time
const BACKUP_DIR = path.join(process.cwd(), "backups");
const RETENTION_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDatabaseUrl(url: string) {
  // mysql://user:password@host:port/dbname
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || "3306",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
  };
}

function timestampForFilename(d: Date): string {
  // Filesystem-safe (no colons) -- 2026-09-10T14-30-00
  return d.toISOString().replace(/:/g, "-").replace(/\.\d+Z$/, "");
}

// AuditLog.userId is NOT NULL -- there's no seeded "system" user in this
// schema (same constraint interviewReminders.ts hit). A scheduled 3am run
// has no human actor to attribute it to, so it's logged under the first
// active IT_ADMIN account found instead -- not who "did" it, but it's what
// makes the automatic run show up as real, dated evidence on the Audit Logs
// page rather than only being provable by checking file timestamps on disk.
// A manual "Run Backup Now" click passes the real actorUserId of whoever
// clicked it, which is used instead.
export async function runBackupNow(opts: { actorUserId?: number; trigger?: "scheduled" | "manual" } = {}): Promise<{ ok: boolean; file?: string; error?: string }> {
  const trigger = opts.trigger ?? "scheduled";
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("Backup job: DATABASE_URL is not set, cannot back up.");
    return { ok: false, error: "DATABASE_URL is not set" };
  }

  let conn: ReturnType<typeof parseDatabaseUrl>;
  try {
    conn = parseDatabaseUrl(databaseUrl);
  } catch (err) {
    console.error("Backup job: could not parse DATABASE_URL:", err);
    return { ok: false, error: "Could not parse DATABASE_URL" };
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const filename = `${conn.database}-${timestampForFilename(new Date())}.sql`;
  const filePath = path.join(BACKUP_DIR, filename);
  const dumpBin = process.env.BACKUP_DUMP_BIN || "mysqldump";

  try {
    // Password passed via MYSQL_PWD env var, not a --password= command-line
    // flag -- command-line args are visible to other processes/users on the
    // same machine (e.g. `ps`/Task Manager command-line column), MYSQL_PWD
    // isn't.
    const { stdout } = await execFileAsync(
      dumpBin,
      ["--host", conn.host, "--port", conn.port, "--user", conn.user, "--single-transaction", "--routines", conn.database],
      { env: { ...process.env, MYSQL_PWD: conn.password }, maxBuffer: 1024 * 1024 * 200 }
    );
    fs.writeFileSync(filePath, stdout);
    console.log(`Backup job: wrote ${filePath} (${(stdout.length / 1024).toFixed(1)} KB).`);
    pruneOldBackups();

    let actorUserId = opts.actorUserId;
    if (actorUserId === undefined) {
      const itAdmin = await prisma.user.findFirst({ where: { role: Role.IT_ADMIN, isActive: true } });
      actorUserId = itAdmin?.id;
    }
    if (actorUserId !== undefined) {
      await writeAuditLog(actorUserId, "SYSTEM_BACKUP_RUN", "System", null, {
        filename,
        sizeBytes: stdout.length,
        trigger,
      });
    } else {
      console.error("Backup job: no IT_ADMIN account found to attribute the audit log entry to -- backup file was still written.");
    }

    return { ok: true, file: filename };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `Backup job: mysqldump failed (tried binary "${dumpBin}" -- if that's not on this machine's PATH, e.g. a MariaDB install that ships "mariadb-dump" instead, set BACKUP_DUMP_BIN):`,
      message
    );
    return { ok: false, error: message };
  }
}

function pruneOldBackups(): void {
  const cutoff = Date.now() - RETENTION_DAYS * MS_PER_DAY;
  let entries: string[];
  try {
    entries = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".sql"));
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(BACKUP_DIR, entry);
    try {
      const stat = fs.statSync(full);
      if (stat.mtimeMs < cutoff) fs.unlinkSync(full);
    } catch (err) {
      console.error(`Backup job: could not prune ${full}:`, err);
    }
  }
}

export function startBackupJob(): void {
  cron.schedule(CHECK_CRON, () => {
    runBackupNow().catch((err) => {
      console.error("Backup job crashed:", err);
    });
  });
  console.log(`Backup job scheduled (${CHECK_CRON}, writing to ${BACKUP_DIR}).`);
}
