// One-off cleanup: the app has no in-app "delete vacancy" capability
// anywhere (checked vacancy.routes.ts -- only stage/interviewer delete
// exist), so a mistakenly-created test vacancy has no way to be removed
// except directly against the DB. Guards against deleting anything with
// real applications attached, since that's the one case a straight
// `prisma.vacancy.delete()` could silently take real data with it (no
// onDelete: Cascade on CandidateApplication.vacancy -- VacancyStage rows
// DO cascade, applications don't).
//
// Run from the backend folder:
//   npx tsx scripts/delete-test-vacancy.ts "v"
// (defaults to deleting a vacancy literally titled "v" if no argument given)
import "dotenv/config";
import { prisma } from "../src/prisma.js";

async function main() {
  const title = process.argv[2] || "v";
  const vacancy = await prisma.vacancy.findFirst({ where: { title } });
  if (!vacancy) {
    console.log(`No vacancy titled "${title}" found -- nothing to delete.`);
    return;
  }
  const appCount = await prisma.candidateApplication.count({ where: { vacancyId: vacancy.id } });
  if (appCount > 0) {
    console.log(
      `Vacancy "${title}" (id ${vacancy.id}) has ${appCount} application(s) attached -- refusing to auto-delete. ` +
        `If you're sure, remove those applications first, or ask and this script can be extended to cascade.`
    );
    return;
  }
  await prisma.vacancy.delete({ where: { id: vacancy.id } });
  console.log(`Deleted vacancy "${title}" (id ${vacancy.id}).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
