import fs from "node:fs/promises";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// Local-disk storage for uploaded CV files, kept behind this module so the
// backing store can be swapped for cloud storage later without touching any
// controller code -- every read/write of a CV file goes through here, same
// choke-point pattern as writeAuditLog()/sendEmail().
//
// Falls back to local disk when B2_BUCKET_NAME isn't set (local dev), same
// pattern as SMTP_* falling back to console-logging emails when
// unconfigured (see docs/cloud-deployment-guide.md). Deployed environments
// set B2_* to use Backblaze B2 instead, which persists independently of the
// compute instance -- fixes R-02 in the risk register (CVs on local disk
// are lost every time Render's free-plan disk resets).
//
// Backblaze B2 exposes an S3-compatible API, so this uses the standard AWS
// S3 SDK pointed at B2's endpoint rather than a Backblaze-specific SDK --
// same client would work unchanged against real AWS S3 or Cloudflare R2 too,
// only the endpoint/credentials differ.
const CV_DIR = path.join(process.cwd(), "uploads", "cvs");
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME;
const B2_ENDPOINT = process.env.B2_ENDPOINT; // e.g. https://s3.eu-central-003.backblazeb2.com
const B2_REGION = process.env.B2_REGION; // e.g. eu-central-003 (the segment in the endpoint above)
const B2_KEY_ID = process.env.B2_KEY_ID; // Backblaze "keyID"
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY; // Backblaze "applicationKey"

const s3 = B2_BUCKET_NAME
  ? new S3Client({
      endpoint: B2_ENDPOINT,
      region: B2_REGION,
      credentials: { accessKeyId: B2_KEY_ID!, secretAccessKey: B2_APPLICATION_KEY! },
    })
  : null;

// Exposed so another module needing the same B2 bucket for a different
// purpose (backupJob.ts, storing database dumps under a "backups/" prefix
// in the same bucket) can reuse this one client/bucket instead of parsing
// the same five B2_* env vars a second time. Null when B2 isn't configured,
// same meaning as everywhere else in this file -- callers should fall back
// to local-disk behaviour of their own when this is null.
export const cloudClient = s3;
export const cloudBucketName = B2_BUCKET_NAME;

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
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: B2_BUCKET_NAME, Key: filename, Body: buffer }));
    return;
  }
  await ensureDir();
  await fs.writeFile(resolveSafePath(filename), buffer);
}

export async function getFile(filename: string): Promise<Buffer> {
  if (s3) {
    const res = await s3.send(new GetObjectCommand({ Bucket: B2_BUCKET_NAME, Key: filename }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }
  return fs.readFile(resolveSafePath(filename));
}

export async function fileExists(filename: string): Promise<boolean> {
  if (s3) {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: B2_BUCKET_NAME, Key: filename }));
      return true;
    } catch {
      return false;
    }
  }
  try {
    await fs.access(resolveSafePath(filename));
    return true;
  } catch {
    return false;
  }
}

export async function renameFile(oldFilename: string, newFilename: string): Promise<void> {
  if (s3) {
    // S3-compatible APIs have no native rename -- copy then delete the
    // original, same net effect as fs.rename() below.
    await s3.send(
      new CopyObjectCommand({
        Bucket: B2_BUCKET_NAME,
        CopySource: `${B2_BUCKET_NAME}/${oldFilename}`,
        Key: newFilename,
      })
    );
    await s3.send(new DeleteObjectCommand({ Bucket: B2_BUCKET_NAME, Key: oldFilename }));
    return;
  }
  await ensureDir();
  // newFilename may include a subfolder-style prefix (e.g. "rejected/foo.pdf"
  // for the CV archiving feature) -- fs.rename() doesn't create missing
  // parent directories itself, so make sure the destination's parent exists
  // first. No-op when newFilename has no subfolder (parent is just CV_DIR,
  // already created by ensureDir() above).
  const destination = resolveSafePath(newFilename);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rename(resolveSafePath(oldFilename), destination);
}

export async function deleteFile(filename: string): Promise<void> {
  if (s3) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: B2_BUCKET_NAME, Key: filename }));
    } catch (err: any) {
      if (err.name !== "NotFound" && err.$metadata?.httpStatusCode !== 404) throw err;
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
