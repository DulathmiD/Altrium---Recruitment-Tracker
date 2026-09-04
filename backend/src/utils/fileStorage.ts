import fs from "node:fs/promises";
import path from "node:path";

// Local-disk storage for uploaded CV files, kept behind this module so the
// backing store can be swapped for cloud storage (e.g. S3) later without
// touching any controller code -- every read/write of a CV file goes
// through here, same choke-point pattern as writeAuditLog()/sendEmail().
const CV_DIR = path.join(process.cwd(), "uploads", "cvs");

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
  await ensureDir();
  await fs.writeFile(resolveSafePath(filename), buffer);
}

export async function getFile(filename: string): Promise<Buffer> {
  return fs.readFile(resolveSafePath(filename));
}

export async function fileExists(filename: string): Promise<boolean> {
  try {
    await fs.access(resolveSafePath(filename));
    return true;
  } catch {
    return false;
  }
}

export async function renameFile(oldFilename: string, newFilename: string): Promise<void> {
  await ensureDir();
  await fs.rename(resolveSafePath(oldFilename), resolveSafePath(newFilename));
}

export async function deleteFile(filename: string): Promise<void> {
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
