// R-01 follow-up: a backup file containing every user's password hash was
// found committed to a public repo (see git history / project decision
// log). Removing it from tracking doesn't undo that exposure -- the
// passwords it protected have to actually change. This resets EVERY user's
// password to a fresh random one and prints them once, so you have working
// demo credentials afterward.
//
// Usage (run from backend/):
//   DATABASE_URL="<the same value used in Render>" node scripts/rotate-all-passwords.mjs
//
// Safe to run against the real (Aiven) database directly -- it only updates
// passwordHash, nothing else. Save the printed output somewhere before
// closing the terminal; it is not shown again.
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import crypto from "node:crypto";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL env var is required.");
  process.exit(1);
}

function generatePassword() {
  // 16 chars from a set that avoids visually-ambiguous characters (0/O,
  // 1/l/I) since these are meant to be read off a terminal and typed in
  // during a demo, not stored in a password manager.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  return Array.from(crypto.randomFillSync(new Uint8Array(16)))
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}

const conn = await mysql.createConnection(databaseUrl);
try {
  const [users] = await conn.execute("SELECT id, email, name FROM `User` ORDER BY id");
  console.log(`Rotating passwords for ${users.length} user(s)...\n`);

  const results = [];
  for (const user of users) {
    const newPassword = generatePassword();
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await conn.execute("UPDATE `User` SET `passwordHash` = ? WHERE `id` = ?", [passwordHash, user.id]);
    results.push({ email: user.email, name: user.name, newPassword });
  }

  console.log("Done. New credentials (save these now, not shown again):\n");
  for (const r of results) {
    console.log(`${r.email.padEnd(30)} ${r.name.padEnd(20)} ${r.newPassword}`);
  }
} finally {
  await conn.end();
}
