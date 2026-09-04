// One-off cleanup script: deletes ONE vacancy (matched by title, case-
// insensitive) and everything that has to go with it to satisfy foreign
// keys -- its applications, those applications' interviews/feedback/stage
// history, its interview panel assignments. Interview rounds (VacancyStage)
// cascade automatically (onDelete: Cascade in schema.prisma). Candidates
// themselves are left alone -- only their application to this vacancy is
// removed, not the Candidate row (they may have applied elsewhere too).
//
// Run from the backend folder:
//   npx tsx scripts/delete-vacancy.ts "Software Engineer"
//
// If more than one vacancy matches the title (different departments), it
// lists them and asks you to also pass the department to disambiguate:
//   npx tsx scripts/delete-vacancy.ts "Software Engineer" "IT"
import "dotenv/config";
import { prisma } from "../src/prisma.js";

async function main() {
  const [title, department] = process.argv.slice(2);
  if (!title) {
    console.error('Usage: npx tsx scripts/delete-vacancy.ts "<title>" ["<department>"]');
    process.exitCode = 1;
    return;
  }

  const matches = await prisma.vacancy.findMany({
    where: {
      title: { equals: title },
      ...(department ? { department: { equals: department } } : {}),
    },
  });

  if (matches.length === 0) {
    console.log(`No vacancy found with title "${title}"${department ? ` in "${department}"` : ""}.`);
    return;
  }
  if (matches.length > 1) {
    console.log(`Multiple vacancies match "${title}" -- re-run with the department to pick one:`);
    for (const m of matches) console.log(`  - ${m.title} / ${m.department} (id ${m.id})`);
    return;
  }

  const vacancy = matches[0]!;
  console.log(`Deleting "${vacancy.title}" / ${vacancy.department} (id ${vacancy.id})...\n`);

  const applications = await prisma.candidateApplication.findMany({
    where: { vacancyId: vacancy.id },
    select: { id: true },
  });
  const applicationIds = applications.map((a) => a.id);

  // Schema split Interview into InterviewSlot (time/panel/round, shared
  // across candidates) + Interview (one candidate's participation) -- a
  // slot always belongs to exactly one vacancy via its vacancyStage, so it's
  // safe to look slots up directly and delete them wholesale here, including
  // any slot HR scheduled for this vacancy that never had a candidate added.
  const slots = await prisma.interviewSlot.findMany({
    where: { vacancyStage: { vacancyId: vacancy.id } },
    select: { id: true },
  });
  const slotIds = slots.map((s) => s.id);

  const interviews = await prisma.interview.findMany({
    where: { slotId: { in: slotIds } },
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
    interviewPanelist: await prisma.interviewPanelist.deleteMany({ where: { slotId: { in: slotIds } } }),
    interviewSlot: await prisma.interviewSlot.deleteMany({ where: { id: { in: slotIds } } }),
    stageRecommendation: await prisma.stageRecommendation.deleteMany({ where: { applicationId: { in: applicationIds } } }),
    applicationStageHistory: await prisma.applicationStageHistory.deleteMany({ where: { applicationId: { in: applicationIds } } }),
    candidateApplication: await prisma.candidateApplication.deleteMany({ where: { vacancyId: vacancy.id } }),
    vacancyInterviewer: await prisma.vacancyInterviewer.deleteMany({ where: { vacancyId: vacancy.id } }),
    vacancy: await prisma.vacancy.delete({ where: { id: vacancy.id } }),
  };

  console.log("Deleted:");
  console.log(`  feedbackAuditLog         ${counts.feedbackAuditLog.count}`);
  console.log(`  feedback                 ${counts.feedback.count}`);
  console.log(`  interview                ${counts.interview.count}`);
  console.log(`  interviewPanelist        ${counts.interviewPanelist.count}`);
  console.log(`  interviewSlot            ${counts.interviewSlot.count}`);
  console.log(`  stageRecommendation      ${counts.stageRecommendation.count}`);
  console.log(`  applicationStageHistory  ${counts.applicationStageHistory.count}`);
  console.log(`  candidateApplication     ${counts.candidateApplication.count}`);
  console.log(`  vacancyInterviewer       ${counts.vacancyInterviewer.count}`);
  console.log(`  vacancy                  1 (its interview rounds cascaded automatically)`);
  console.log("\nDone. Candidates themselves were left untouched.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
