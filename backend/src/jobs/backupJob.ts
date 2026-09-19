// Backlog item: "As an IT administrator, I want automatic system backups to
// prevent data loss." Previously entirely fake -- system.controller.ts's
// buildSimulatedBackupHistory() generated a deterministic "always
// Successful" history with no backup job, no dump, and no storage target
// behind it at all (see that file's own comment, now stale and removed as
// part of this change). This replaces the simulation with a real scheduled
// database dump writing timestamped .sql files to backend/backups/, which
// system.controller.ts now lists for real instead of fabricating.
//
// Connection details are parsed from DATABASE_URL (already required for
// Prisma) rather than duplicating SMTP-style separate env vars -- one fewer
// thing to configure.
//
// Dump generation: originally shelled out to the `mysqldump` command-line
// tool via execFile. That assumed the deploy environment has it installed --
// it doesn't (Render's standard Node runtime has no MySQL client tools, and
// there's no supported way to apt-get install one there), which surfaced as
// "spawn mysqldump ENOENT" the first time this actually ran on Render rather
// than locally. Replaced with the `mysqldump` npm package, which generates
// the dump itself in pure JS via the same mysql2 driver already used
// elsewhere in this project (Prisma's adapter), so it needs nothing
// installed on the host at all.
import cron from "node-cron";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import mysqldump from "mysqldump";
import { PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "../prisma.js";
import { Role } from "../../generated/prisma/index.js";
import { writeAuditLog } from "../utils/auditLog.js";
import { cloudClient, cloudBucketName } from "../utils/fileStorage.js";

// R-01 in the risk register: backup dumps contain every candidate's personal
// data and every user account's password hash in one plaintext file -- a
// real instance of exactly this was found already committed to source
// control (see the .gitignore fix and git history note in the project
// decision log). Encrypts the dump before it's ever written anywhere --
// local disk or B2 -- when BACKUP_ENCRYPTION_KEY is set, following this
// project's established fallback pattern (same idea as SMTP_*/B2_* falling
// back to a simpler local behaviour when unconfigured). Local dev without
// the key still gets a working plaintext backup rather than erroring, but
// the deployed environment MUST set this key for the mitigation to actually
// apply -- code capability alone doesn't close this risk, the env var does.
//
// AES-256-GCM: authenticated encryption, so a tampered/corrupted backup
// fails to decrypt loudly rather than silently restoring corrupted data.
// Key is a 32-byte value, base64-encoded in the env var (generate with
// `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
const BACKUP_ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY;
const GCM_IV_LENGTH = 12;

function encryptBackup(plaintext: Buffer): Buffer {
  const key = Buffer.from(BACKUP_ENCRYPTION_KEY!, "base64");
  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Self-contained envelope: [12-byte IV][16-byte auth tag][ciphertext] --
  // everything needed to decrypt is in the file itself except the key.
  return Buffer.concat([iv, authTag, ciphertext]);
}

// Local dump files still get written to BACKUP_DIR below regardless of
// cloud config -- that part is unchanged from before. But BACKUP_DIR lives
// on Render's disk, which is wiped on every restart/redeploy (same root
// cause as R-02 for CVs, before that was fixed). A backup that only exists
// on the same disk that just got wiped isn't a backup. So when B2 is
// configured (reusing the same bucket/credentials CVs already use, under a
// "backups/" prefix -- no separate bucket needed), each dump is also
// uploaded there, which is what actually survives a restart.
const CLOUD_BACKUP_PREFIX = "backups/";

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

  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  // R-01: restrict to owner-only, in case the directory already existed
  // from before this fix (mkdirSync's mode only applies on creation, not to
  // an already-existing directory). No-op on Windows -- chmod only has real
  // effect on POSIX filesystems, but the deployed target (Render) is Linux.
  try {
    fs.chmodSync(BACKUP_DIR, 0o700);
  } catch (err) {
    console.error("Backup job: could not chmod backup directory:", err);
  }

  // .enc suffix reflects reality -- an encrypted file is not valid SQL text
  // anymore, and system.controller.ts's history listing / pruneOldBackups
  // below both match on this suffix.
  const filename = `${conn.database}-${timestampForFilename(new Date())}.sql${BACKUP_ENCRYPTION_KEY ? ".enc" : ""}`;
  const filePath = path.join(BACKUP_DIR, filename);

  try {
    const result = await mysqldump({
      connection: {
        host: conn.host,
        port: Number(conn.port),
        user: conn.user,
        password: conn.password,
        database: conn.database,
      },
    });
    // The library splits schema/data/triggers out separately (each null if
    // the DB has none) -- concatenated back into one .sql file, same shape
    // as a single mysqldump CLI output would have produced.
    const sql = [result.dump.schema, result.dump.trigger, result.dump.data].filter((part) => part).join("\n\n");
    const fileBytes = BACKUP_ENCRYPTION_KEY ? encryptBackup(Buffer.from(sql)) : Buffer.from(sql);
    if (!BACKUP_ENCRYPTION_KEY) {
      console.error(
        "Backup job: BACKUP_ENCRYPTION_KEY is not set -- writing this backup UNENCRYPTED. Fine for local dev, but the deployed environment must set this for R-01 to actually be mitigated."
      );
    }

    fs.writeFileSync(filePath, fileBytes, { mode: 0o600 });
    fs.chmodSync(filePath, 0o600); // belt-and-braces in case the file already existed
    console.log(`Backup job: wrote ${filePath} (${(fileBytes.length / 1024).toFixed(1)} KB${BACKUP_ENCRYPTION_KEY ? ", encrypted" : ""}).`);

    if (cloudClient) {
      try {
        await cloudClient.send(
          new PutObjectCommand({ Bucket: cloudBucketName, Key: `${CLOUD_BACKUP_PREFIX}${filename}`, Body: fileBytes })
        );
        console.log(`Backup job: also uploaded ${filename} to cloud storage (${CLOUD_BACKUP_PREFIX}).`);
      } catch (err) {
        // A cloud upload failure shouldn't fail the whole backup run -- the
        // local copy still exists (until the next restart), and the next
        // scheduled run will try again. Logged loudly since this is exactly
        // the kind of silent failure that made the local-only version look
        // fine until someone actually needed a backup.
        console.error(`Backup job: local dump succeeded but cloud upload failed for ${filename}:`, err);
      }
    }

    pruneOldBackups();
    if (cloudClient) await pruneOldCloudBackups();

    let actorUserId = opts.actorUserId;
    if (actorUserId === undefined) {
      const itAdmin = await prisma.user.findFirst({ where: { role: Role.IT_ADMIN, isActive: true } });
      actorUserId = itAdmin?.id;
    }
    if (actorUserId !== undefined) {
      await writeAuditLog(actorUserId, "SYSTEM_BACKUP_RUN", "System", null, {
        filename,
        sizeBytes: fileBytes.length,
        trigger,
      });
    } else {
      console.error("Backup job: no IT_ADMIN account found to attribute the audit log entry to -- backup file was still written.");
    }

    return { ok: true, file: filename };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Backup job: database dump failed:", message);
    return { ok: false, error: message };
  }
}

function pruneOldBackups(): void {
  const cutoff = Date.now() - RETENTION_DAYS * MS_PER_DAY;
  let entries: string[];
  try {
    entries = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".sql") || f.endsWith(".sql.enc"));
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

// Same 14-day retention as pruneOldBackups() above, applied to the cloud
// copies instead. Needed separately -- the two live in different places and
// nothing else clears out old cloud backups.
async function pruneOldCloudBackups(): Promise<void> {
  const cutoff = Date.now() - RETENTION_DAYS * MS_PER_DAY;
  try {
    const listed = await cloudClient!.send(
      new ListObjectsV2Command({ Bucket: cloudBucketName, Prefix: CLOUD_BACKUP_PREFIX })
    );
    for (const obj of listed.Contents ?? []) {
      if (obj.Key && obj.LastModified && obj.LastModified.getTime() < cutoff) {
        await cloudClient!.send(new DeleteObjectCommand({ Bucket: cloudBucketName, Key: obj.Key }));
      }
    }
  } catch (err) {
    console.error("Backup job: could not prune old cloud backups:", err);
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
