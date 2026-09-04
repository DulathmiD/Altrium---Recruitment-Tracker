// One-off migration: the 7 canonical seed accounts (backend/prisma/seed.ts)
// used to live on @altrium.test. That domain was picked deliberately --
// .test is one of the handful of TLDs (with .example, .invalid, .localhost)
// that IANA reserves specifically so it can never resolve to a real mail
// server, guaranteeing test data can't accidentally reach a real inbox.
// Switched to @altrium.com since it reads as a real company domain for
// demos/screenshots.
//
// seed.ts's upsert matches on email, so simply changing the domain there and
// re-running `npx prisma db seed` would NOT rename these 7 existing users --
// it would create 7 brand-new rows on the new domain while the old
// @altrium.test rows (and everything already linked to their user IDs:
// vacancies, applications, interviews, audit log entries...) stay right
// where they are. This script updates the email in place on the existing
// rows instead, so the same user IDs -- and everything already linked to
// them -- carry straight over. Safe to re-run: any pair already renamed (or
// never seeded) is skipped.
//
// Run from the backend folder:
//   npx tsx scripts/rename-seed-domain.ts
import "dotenv/config";
import { prisma } from "../src/prisma.js";

const RENAMES: Array<[oldEmail: string, newEmail: string]> = [
  ["hr@altrium.test", "hr@altrium.com"],
  ["interviewer@altrium.test", "interviewer@altrium.com"],
  ["management@altrium.test", "management@altrium.com"],
  ["hiringmanager@altrium.test", "hiringmanager@altrium.com"],
  ["itadmin@altrium.test", "itadmin@altrium.com"],
  ["leadership@altrium.test", "leadership@altrium.com"],
  ["disabled@altrium.test", "disabled@altrium.com"],
];

async function main() {
  console.log("");
  for (const [oldEmail, newEmail] of RENAMES) {
    const existing = await prisma.user.findUnique({ where: { email: oldEmail } });
    if (!existing) {
      console.log(`Skipping ${oldEmail} -- not found (already renamed, or never seeded).`);
      continue;
    }

    const clash = await prisma.user.findUnique({ where: { email: newEmail } });
    if (clash) {
      console.log(`Skipping ${oldEmail} -- ${newEmail} is already taken by a different user (id ${clash.id}).`);
      continue;
    }

    await prisma.user.update({ where: { id: existing.id }, data: { email: newEmail } });
    console.log(`Renamed: ${oldEmail}  ->  ${newEmail}`);
  }
  console.log("\nDone. Passwords are unchanged -- still password123 for every account above.\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
