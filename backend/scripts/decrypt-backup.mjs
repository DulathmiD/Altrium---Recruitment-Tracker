// Decrypts a .sql.enc backup file produced by backupJob.ts back into plain
// .sql, for actually restoring from a backup. An encrypted backup nobody
// can decrypt again isn't a real mitigation for R-01, just theatre -- this
// is the other half of that fix.
//
// Usage:
//   BACKUP_ENCRYPTION_KEY="<the same key set in Render>" node scripts/decrypt-backup.mjs <input.sql.enc> [output.sql]
//
// If output path is omitted, writes next to the input file with .sql.enc
// replaced by .sql.
import { readFileSync, writeFileSync } from "node:fs";
import crypto from "node:crypto";

const [, , inputPath, outputPathArg] = process.argv;
const key = process.env.BACKUP_ENCRYPTION_KEY;

if (!inputPath) {
  console.error("Usage: BACKUP_ENCRYPTION_KEY=<key> node scripts/decrypt-backup.mjs <input.sql.enc> [output.sql]");
  process.exit(1);
}
if (!key) {
  console.error("BACKUP_ENCRYPTION_KEY env var is required -- use the same value set in Render's Environment tab.");
  process.exit(1);
}

const outputPath = outputPathArg || inputPath.replace(/\.sql\.enc$/, ".sql");

// Must match encryptBackup()'s envelope layout in backend/src/jobs/backupJob.ts
// exactly: [12-byte IV][16-byte auth tag][ciphertext].
const envelope = readFileSync(inputPath);
const iv = envelope.subarray(0, 12);
const authTag = envelope.subarray(12, 28);
const ciphertext = envelope.subarray(28);

const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(key, "base64"), iv);
decipher.setAuthTag(authTag);

let plaintext;
try {
  plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
} catch (err) {
  console.error("Decryption failed -- wrong key, or the file is corrupted/tampered with:", err.message);
  process.exit(1);
}

writeFileSync(outputPath, plaintext);
console.log(`Decrypted ${inputPath} -> ${outputPath} (${(plaintext.length / 1024).toFixed(1)} KB)`);
