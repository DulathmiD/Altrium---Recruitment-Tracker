// Follow-up to rotate-all-passwords.mjs: that script correctly closed R-07
// (config secrets never a real security fix for user passwords, which were
// always bcrypt-hashed and never actually exposed) but had a real side
// effect -- it replaced every demo account's memorized password with a
// random one, breaking the credentials used during live viva demos for no
// actual security gain. This resets each account back to its known,
// memorable password (still freshly bcrypt-hashed the exact same way --
// hashing doesn't care what the input string is, so this is not a step
// backwards in security, just a practical one for a coursework demo).
//
// Usage (run from backend/):
//   DATABASE_URL="<the same value used in Render>" node scripts/reset-demo-passwords.mjs
//
// Safe to run against the real (Aiven) database directly -- it only updates
// passwordHash, matched by email, nothing else.
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL env var is required.");
  process.exit(1);
}

const KNOWN_PASSWORDS = [
  { email: "sharon@altrium.com", password: "Sharon@2026" },
  { email: "rachel@altrium.com", password: "Rachel@2026" },
  { email: "marcus@altrium.com", password: "Marcus@2026" },
  { email: "dulzxitzy@gmail.com", password: "Jordan@2026" },
  { email: "victor@altrium.com", password: "Victor@2026" },
  { email: "naomi@altrium.com", password: "Naomi@2026" },
  { email: "daniel@altrium.com", password: "Daniel@2026" },
  { email: "elena@altrium.com", password: "Elena@2026" },
  { email: "bianca@altrium.com", password: "Bianca@2026" },
  { email: "derek@altrium.com", password: "Derek@2026" },
  { email: "fatima@altrium.com", password: "Fatima@2026" },
  { email: "callum@altrium.com", password: "Callum@2026" },
  { email: "nadia@altrium.com", password: "Nadia@2026" },
  { email: "owen@altrium.com", password: "Owen@2026" },
  { email: "miriam@altrium.com", password: "Miriam@2026" },
];

const conn = await mysql.createConnection(databaseUrl);
try {
  console.log(`Resetting ${KNOWN_PASSWORDS.length} account(s) to their known demo passwords...\n`);

  let updated = 0;
  let notFound = [];
  for (const { email, password } of KNOWN_PASSWORDS) {
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await conn.execute(
      "UPDATE `User` SET `passwordHash` = ? WHERE `email` = ?",
      [passwordHash, email]
    );
    if (result.affectedRows === 0) {
      notFound.push(email);
    } else {
      updated += result.affectedRows;
      console.log(`  updated: ${email}`);
    }
  }

  console.log(`\nDone. ${updated} account(s) reset to their known password.`);
  if (notFound.length) {
    console.log(`No matching account found for: ${notFound.join(", ")}`);
  }
} finally {
  await conn.end();
}
