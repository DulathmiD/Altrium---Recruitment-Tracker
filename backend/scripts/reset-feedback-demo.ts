// One-off utility for un-submitting a specific piece of interview feedback,
// so the interview can be shown as "pending" again in a live demo (e.g. the
// viva) instead of already having feedback on it. Deletes the Feedback
// row(s) for one candidate's interview at a named vacancy/round, plus any
// FeedbackAuditLog rows attached to them (FK: FeedbackAuditLog.feedbackId ->
// Feedback.id, so the audit rows must go first or the delete violates the
// constraint).
//
// Matches by candidate name + vacancy title + round/stage name, not by ID --
// safer to type correctly from what's on screen than to guess numeric IDs
// with no DB access from this session.
//
// Usage (run from the backend folder):
//   npx tsx scripts/reset-feedback-demo.ts "Naledi Khumalo" "Account Executive" "Role Play Interview"
//
// Deletes ALL feedback (every interviewer's) on that one candidate's
// interview for that one round -- not just one interviewer's -- since the
// goal is "show this as not-yet-reviewed," which should be true regardless
// of who's logged in when you demo it.
import "dotenv/config";
import { prisma } from "../src/prisma.js";

async function main() {
  const [candidateName, vacancyTitle, roundName] = process.argv.slice(2);
  if (!candidateName || !vacancyTitle || !roundName) {
    throw new Error(
      'Usage: npx tsx scripts/reset-feedback-demo.ts "<candidate name>" "<vacancy title>" "<round name>"'
    );
  }

  const candidate = await prisma.candidate.findFirst({ where: { name: candidateName } });
  if (!candidate) throw new Error(`No candidate named "${candidateName}".`);

  const vacancy = await prisma.vacancy.findFirst({ where: { title: vacancyTitle } });
  if (!vacancy) throw new Error(`No vacancy titled "${vacancyTitle}".`);

  const application = await prisma.candidateApplication.findFirst({
    where: { candidateId: candidate.id, vacancyId: vacancy.id },
  });
  if (!application) throw new Error(`"${candidateName}" has no application to "${vacancyTitle}".`);

  const stage = await prisma.vacancyStage.findFirst({
    where: { vacancyId: vacancy.id, name: roundName },
  });
  if (!stage) throw new Error(`No round named "${roundName}" on "${vacancyTitle}".`);

  const interview = await prisma.interview.findFirst({
    where: { applicationId: application.id, slot: { vacancyStageId: stage.id } },
    include: { feedback: true },
  });
  if (!interview) {
    console.log(`No interview found for "${candidateName}" at "${vacancyTitle}" / "${roundName}" -- nothing to reset.`);
    return;
  }
  if (interview.feedback.length === 0) {
    console.log(`That interview already has no feedback -- nothing to reset.`);
    return;
  }

  const feedbackIds = interview.feedback.map((f) => f.id);

  const deletedAudit = await prisma.feedbackAuditLog.deleteMany({
    where: { feedbackId: { in: feedbackIds } },
  });
  const deletedFeedback = await prisma.feedback.deleteMany({
    where: { id: { in: feedbackIds } },
  });

  console.log(
    `Reset "${candidateName}" / "${vacancyTitle}" / "${roundName}": deleted ${deletedFeedback.count} feedback row(s) and ${deletedAudit.count} audit-log row(s). This interview is pending again.`
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
