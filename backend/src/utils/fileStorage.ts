import fs from "node:fs/promises";
import path from "node:path";
import { Storage } from "@google-cloud/storage";

// Local-disk storage for uploaded CV files, kept behind this module so the
// backing store can be swapped for cloud storage later without touching any
// controller code -- every read/write of a CV file goes through here, same
// choke-point pattern as writeAuditLog()/sendEmail().
//
// Falls back to local disk when GCS_BUCKET_NAME isn't set (local dev), same
// pattern as SMTP_* falling back to console-logging emails when
// unconfigured (see docs/cloud-deployment-guide.md). Deployed environments
// set GCS_BUCKET_NAME to use Google Cloud Storage instead, which persists
// independently of the compute instance -- fixes R-02 in the risk register
// (CVs on local disk are lost every time Render's free-plan disk resets).
const CV_DIR = path.join(process.cwd(), "uploads", "cvs");
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;

const storage = GCS_BUCKET_NAME
  ? new Storage(
      process.env.GCS_KEYFILE_JSON
        ? { credentials: JSON.parse(process.env.GCS_KEYFILE_JSON) }
        : undefined // falls back to Application Default Credentials if unset
    )
  : null;
const bucket = storage && GCS_BUCKET_NAME ? storage.bucket(GCS_BUCKET_NAME) : null;

async function ensureDir(): Promise<void> {
  await fs.mkdir(CV_DIR, { recursive: true });
}

// Defense in depth: every filename that reaches this module should already
// be one we generated (randomUUID()-based or candidate-id-prefixed), but any
// caller that's ever wired up to user input (directly or indirectly, e.g.
// through a future edit endpoint) must not be able to escape CV_DIR via
// "../" or an absolute path. Resolve and verify containment rather than
// trusting the input shape.
function resolveSafePath(filename: string): string {
  const resolved = path.resolve(CV_DIR, filename);
  if (resolved !== CV_DIR && !resolved.startsWith(CV_DIR + path.sep)) {
    throw new Error(`Rejected unsafe file path: ${filename}`);
  }
  return resolved;
}

export async function saveFile(buffer: Buffer, filename: string): Promise<void> {
  if (bucket) {
    await bucket.file(filename).save(buffer);
    return;
  }
  await ensureDir();
  await fs.writeFile(resolveSafePath(filename), buffer);
}

export async function getFile(filename: string): Promise<Buffer> {
  if (bucket) {
    const [contents] = await bucket.file(filename).download();
    return contents;
  }
  return fs.readFile(resolveSafePath(filename));
}

export async function fileExists(filename: string): Promise<boolean> {
  if (bucket) {
    const [exists] = await bucket.file(filename).exists();
    return exists;
  }
  try {
    await fs.access(resolveSafePath(filename));
    return true;
  } catch {
    return false;
  }
}

export async function renameFile(oldFilename: string, newFilename: string): Promise<void> {
  if (bucket) {
    // GCS has no native rename -- copy then delete the original, same net
    // effect as fs.rename() below.
    await bucket.file(oldFilename).copy(bucket.file(newFilename));
    await bucket.file(oldFilename).delete();
    return;
  }
  await ensureDir();
  await fs.rename(resolveSafePath(oldFilename), resolveSafePath(newFilename));
}

export async function deleteFile(filename: string): Promise<void> {
  if (bucket) {
    try {
      await bucket.file(filename).delete();
    } catch (err: any) {
      if (err.code !== 404) throw err;
    }
    return;
  }
  try {
    await fs.unlink(resolveSafePath(filename));
  } catch (err: any) {
    if (err.code !== "ENOENT") throw err;
  }
}

// Strips anything that isn't safe in a filename across Windows/Linux, so a
// candidate's real name can be embedded in the stored filename without risk.
export function sanitizeForFilename(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "candidate";
}
