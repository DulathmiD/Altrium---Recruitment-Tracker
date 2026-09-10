// One-off utility to fully remove a candidate before a live demo -- built
// specifically so "freddie.sandhu@example.com" (a seeded candidate) can be
// deleted before uploading a live CV with that same email during the viva.
// Candidate.email is unique, so uploading a CV for an email that already
// exists triggers the SCRUM2-30 duplicate-match flow instead of creating a
// fresh candidate (see confirmCvUpload in candidate.controller.ts) -- fine
// in normal use, but not what you want live on stage when the point is to
// show a brand-new candidate being created.
//
// Deletes everything that references this candidate, in dependency order,
// inside one transaction: FeedbackAuditLog -> Feedback -> Interview ->
// ApplicationStageHistory -> StageRecommendation -> CandidateApplication ->
// Candidate. Does NOT touch InterviewSlot rows (a slot can be shared by
// other candidates) or AuditLog rows (those are a permanent record of past
// actions, not something a candidate deletion should rewrite).
//
// Run from the backend folder:
//   npx tsx scripts/delete-candidate-by-email.ts freddie.sandhu@example.com
import "dotenv/config";
import { prisma } from "../src/prisma.js";

async function main() {
  const email = process.argv[2];
  if (!email) {
    throw new Error("Usage: npx tsx scripts/delete-candidate-by-email.ts <email>");
  }

  const candidate = await prisma.candidate.findUnique({
    where: { email },
    include: { applications: { include: { interviews: true } } },
  });

  if (!candidate) {
    console.log(`No candidate found with email ${email} -- nothing to delete.`);
    return;
  }

  const applicationIds = candidate.applications.map((a) => a.id);
  const interviewIds = candidate.applications.flatMap((a) => a.interviews.map((i) => i.id));

  await prisma.$transaction(async (tx) => {
    if (interviewIds.length > 0) {
      const feedbackRows = await tx.feedback.findMany({
        where: { interviewId: { in: interviewIds } },
        select: { id: true },
      });
      const feedbackIds = feedbackRows.map((f) => f.id);
      if (feedbackIds.length > 0) {
        await tx.feedbackAuditLog.deleteMany({ where: { feedbackId: { in: feedbackIds } } });
        await tx.feedback.deleteMany({ where: { id: { in: feedbackIds } } });
      }
      await tx.interview.deleteMany({ where: { id: { in: interviewIds } } });
    }
    if (applicationIds.length > 0) {
      await tx.applicationStageHistory.deleteMany({ where: { applicationId: { in: applicationIds } } });
      await tx.stageRecommendation.deleteMany({ where: { applicationId: { in: applicationIds } } });
      await tx.candidateApplication.deleteMany({ where: { id: { in: applicationIds } } });
    }
    await tx.candidate.delete({ where: { id: candidate.id } });
  });

  console.log(
    `Deleted candidate "${candidate.name}" (${email}) -- ${applicationIds.length} application(s) and ${interviewIds.length} interview(s) removed with it.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
