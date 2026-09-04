// One-off cleanup script: deletes staff (User rows). Two modes based on
// what you pass in:
//   - contains "@"  -> treated as an exact email match, deletes that ONE
//                      person. Safest option for removing a single named
//                      staff member without risking a name collision.
//   - anything else -> treated as a name prefix (case-sensitive, matches
//                      MySQL's default collation), deletes every User whose
//                      name starts with it. Built for clearing out
//                      throwaway/regression test accounts in bulk (e.g.
//                      "Regression Interviewer 2 20260828011839") without
//                      touching real accounts like "Harry Hiring Manager",
//                      which doesn't match that prefix.
//
// Deletes every FK-dependent row first (panel assignments, feedback given,
// feedback edit history, stage recommendations, system audit log entries).
// For "who did this" pointers on records that should survive untouched
// (an application's decidedBy/assignedHiringManager, a stage history row's
// changedBy, a candidate's lastCvReviewedBy), the pointer is cleared to
// null rather than deleting the application/candidate/history row itself.
//
// Run from the backend folder:
//   npx tsx scripts/delete-staff.ts "ivy.alvarez@altrium.com"
//   npx tsx scripts/delete-staff.ts "Regression Interviewer"
import "dotenv/config";
import { prisma } from "../src/prisma.js";

async function main() {
  const [target] = process.argv.slice(2);
  if (!target) {
    console.error('Usage: npx tsx scripts/delete-staff.ts "<email>"   (deletes that one person)');
    console.error('   or: npx tsx scripts/delete-staff.ts "<name prefix>"   (deletes every match)');
    process.exitCode = 1;
    return;
  }

  const byEmail = target.includes("@");
  const users = await prisma.user.findMany({
    where: byEmail ? { email: target } : { name: { startsWith: target } },
    select: { id: true, name: true, email: true },
  });

  if (users.length === 0) {
    console.log(
      byEmail ? `No staff found with email "${target}".` : `No staff found with a name starting with "${target}".`
    );
    return;
  }

  console.log(`Deleting ${users.length} staff member(s):`);
  users.forEach((u) => console.log(`  ${u.name} <${u.email}>`));
  console.log("");

  const userIds = users.map((u) => u.id);

  const feedbackIds = (
    await prisma.feedback.findMany({ where: { interviewerId: { in: userIds } }, select: { id: true } })
  ).map((f) => f.id);

  const counts = {
    feedbackAuditLog: await prisma.feedbackAuditLog.deleteMany({
      where: { OR: [{ feedbackId: { in: feedbackIds } }, { editedByUserId: { in: userIds } }] },
    }),
    feedback: await prisma.feedback.deleteMany({ where: { id: { in: feedbackIds } } }),
    interviewPanelist: await prisma.interviewPanelist.deleteMany({ where: { userId: { in: userIds } } }),
    vacancyInterviewer: await prisma.vacancyInterviewer.deleteMany({ where: { userId: { in: userIds } } }),
    stageRecommendation: await prisma.stageRecommendation.deleteMany({ where: { hiringManagerId: { in: userIds } } }),
    auditLog: await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } }),
  };

  const nulled = {
    decidedBy: await prisma.candidateApplication.updateMany({
      where: { decidedByUserId: { in: userIds } },
      data: { decidedByUserId: null },
    }),
    assignedHiringManager: await prisma.candidateApplication.updateMany({
      where: { hiringManagerId: { in: userIds } },
      data: { hiringManagerId: null },
    }),
    changedBy: await prisma.applicationStageHistory.updateMany({
      where: { changedByUserId: { in: userIds } },
      data: { changedByUserId: null },
    }),
    lastCvReviewedBy: await prisma.candidate.updateMany({
      where: { lastCvReviewedByUserId: { in: userIds } },
      data: { lastCvReviewedByUserId: null },
    }),
  };

  console.log("Deleted:");
  console.log(`  feedbackAuditLog       ${counts.feedbackAuditLog.count}`);
  console.log(`  feedback               ${counts.feedback.count}`);
  console.log(`  interviewPanelist      ${counts.interviewPanelist.count}`);
  console.log(`  vacancyInterviewer     ${counts.vacancyInterviewer.count}`);
  console.log(`  stageRecommendation    ${counts.stageRecommendation.count}`);
  console.log(`  auditLog               ${counts.auditLog.count}`);
  console.log("Cleared \"who did this\" pointers (record itself kept):");
  console.log(`  decidedBy              ${nulled.decidedBy.count}`);
  console.log(`  assignedHiringManager  ${nulled.assignedHiringManager.count}`);
  console.log(`  changedBy              ${nulled.changedBy.count}`);
  console.log(`  lastCvReviewedBy       ${nulled.lastCvReviewedBy.count}`);

  const deleted = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log(`\nDeleted ${deleted.count} user(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
