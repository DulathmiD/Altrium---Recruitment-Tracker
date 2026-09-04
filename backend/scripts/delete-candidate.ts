// One-off cleanup script: deletes ONE candidate (matched by email, which is
// unique) and everything that has to go with it to satisfy foreign keys --
// their applications, those applications' interviews/feedback/stage history
// -- plus their uploaded CV file on disk. Vacancies and other candidates are
// left untouched.
//
// Run from the backend folder:
//   npx tsx scripts/delete-candidate.ts "jordan.whitfield@example.com"
import "dotenv/config";
import { prisma } from "../src/prisma.js";
import { deleteFile } from "../src/utils/fileStorage.js";

async function main() {
  const [email] = process.argv.slice(2);
  if (!email) {
    console.error('Usage: npx tsx scripts/delete-candidate.ts "<email>"');
    process.exitCode = 1;
    return;
  }

  const candidate = await prisma.candidate.findUnique({ where: { email } });
  if (!candidate) {
    console.log(`No candidate found with email "${email}".`);
    return;
  }

  console.log(`Deleting "${candidate.name}" <${candidate.email}> (id ${candidate.id})...\n`);

  const applications = await prisma.candidateApplication.findMany({
    where: { candidateId: candidate.id },
    select: { id: true },
  });
  const applicationIds = applications.map((a) => a.id);

  // Interview rows are per-candidate, but the InterviewSlot (and its
  // panelists) they belong to may be shared with other candidates -- only
  // this candidate's own Interview rows get removed, the slot itself is
  // left alone even if this was the last candidate in it (an empty slot
  // isn't this script's concern).
  const interviews = await prisma.interview.findMany({
    where: { applicationId: { in: applicationIds } },
    select: { id: true },
  });
  const interviewIds = interviews.map((i) => i.id);

  const feedback = await prisma.feedback.findMany({
    where: { interviewId: { in: interviewIds } },
    select: { id: true },
  });
  const feedbackIds = feedback.map((f) => f.id);

  const counts = {
    feedbackAuditLog: await prisma.feedbackAuditLog.deleteMany({ where: { feedbackId: { in: feedbackIds } } }),
    feedback: await prisma.feedback.deleteMany({ where: { id: { in: feedbackIds } } }),
    interview: await prisma.interview.deleteMany({ where: { id: { in: interviewIds } } }),
    stageRecommendation: await prisma.stageRecommendation.deleteMany({ where: { applicationId: { in: applicationIds } } }),
    applicationStageHistory: await prisma.applicationStageHistory.deleteMany({ where: { applicationId: { in: applicationIds } } }),
  };

  console.log("Deleted:");
  console.log(`  feedbackAuditLog         ${counts.feedbackAuditLog.count}`);
  console.log(`  feedback                 ${counts.feedback.count}`);
  console.log(`  interview                ${counts.interview.count}`);
  console.log(`  stageRecommendation      ${counts.stageRecommendation.count}`);
  console.log(`  applicationStageHistory  ${counts.applicationStageHistory.count}`);

  const appCount = await prisma.candidateApplication.deleteMany({ where: { candidateId: candidate.id } });
  console.log(`  candidateApplication     ${appCount.count}`);

  await prisma.candidate.delete({ where: { id: candidate.id } });
  console.log(`  candidate                1`);

  if (candidate.cvUrl) {
    await deleteFile(candidate.cvUrl);
    console.log(`\nRemoved CV file: ${candidate.cvUrl}`);
  }

  console.log("\nDone. Vacancies and other candidates were left untouched.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
