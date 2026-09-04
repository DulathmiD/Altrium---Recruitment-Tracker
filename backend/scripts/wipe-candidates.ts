// One-off cleanup script: deletes every candidate and everything that hangs
// off a candidate (applications, interviews, panelists, feedback, feedback
// edit history, stage recommendations, stage history) plus their uploaded CV
// files on disk -- AND every vacancy and everything that hangs off a vacancy
// (interview panel assignments, interview rounds). Leaves user accounts
// untouched.
//
// Run from the backend folder:
//   npx tsx scripts/wipe-candidates.ts
//
// Deletion order matters -- children before parents -- because most of these
// relations aren't set up with onDelete: Cascade in schema.prisma, so
// deleting a Candidate/Vacancy while something still points at it would fail
// on the foreign key. Candidates go first since CandidateApplication also
// points at Vacancy -- that link has to be gone before Vacancy can go too.
import "dotenv/config";
import { prisma } from "../src/prisma.js";
import { deleteFile } from "../src/utils/fileStorage.js";

async function main() {
  const candidates = await prisma.candidate.findMany({ select: { id: true, cvUrl: true } });
  const vacancyCount = await prisma.vacancy.count();
  console.log(`Found ${candidates.length} candidate(s) and ${vacancyCount} vacancy(ies) to remove.\n`);

  if (candidates.length === 0 && vacancyCount === 0) {
    console.log("Nothing to do.");
    return;
  }

  const counts = {
    feedbackAuditLog: await prisma.feedbackAuditLog.deleteMany({}),
    feedback: await prisma.feedback.deleteMany({}),
    interviewPanelist: await prisma.interviewPanelist.deleteMany({}),
    interview: await prisma.interview.deleteMany({}),
    // InterviewSlot (time/panel/round, shared across candidates -- see
    // schema.prisma) must go after interview/interviewPanelist (both FK
    // into it) and before vacancyStage (it FKs into that).
    interviewSlot: await prisma.interviewSlot.deleteMany({}),
    stageRecommendation: await prisma.stageRecommendation.deleteMany({}),
    applicationStageHistory: await prisma.applicationStageHistory.deleteMany({}),
    candidateApplication: await prisma.candidateApplication.deleteMany({}),
    candidate: await prisma.candidate.deleteMany({}),
    vacancyInterviewer: await prisma.vacancyInterviewer.deleteMany({}),
    vacancyStage: await prisma.vacancyStage.deleteMany({}),
    vacancy: await prisma.vacancy.deleteMany({}),
  };

  console.log("Deleted rows:");
  for (const [table, result] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(24)} ${result.count}`);
  }

  console.log(`\nRemoving ${candidates.length} CV file(s) from uploads/cvs...`);
  for (const c of candidates) {
    if (c.cvUrl) await deleteFile(c.cvUrl);
  }

  console.log("\nDone. User accounts were left untouched.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
