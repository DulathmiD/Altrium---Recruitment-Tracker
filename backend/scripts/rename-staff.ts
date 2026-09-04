// One-off helper: renames a single existing User by email. Needed because
// re-running prisma/seed.ts won't fix already-created rows -- its upsert
// only sets fields on first creation (`update: {}`), so an already-seeded
// account keeps its original name forever unless changed explicitly here
// (or via IT Admin > Users > the pencil/edit button in the app itself,
// which does the same update through the UI).
//
// Run from the backend folder:
//   npx tsx scripts/rename-staff.ts "hiringmanager@altrium.com" "Harry Dawson"
import "dotenv/config";
import { prisma } from "../src/prisma.js";

async function main() {
  const [email, newName] = process.argv.slice(2);
  if (!email || !newName) {
    console.error('Usage: npx tsx scripts/rename-staff.ts "<email>" "<new name>"');
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    console.log(`No user found with email "${email}".`);
    return;
  }

  await prisma.user.update({ where: { id: existing.id }, data: { name: newName } });
  console.log(`Renamed "${existing.name}" -> "${newName}" <${email}>.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
