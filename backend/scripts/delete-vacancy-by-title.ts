// One-off utility to fully remove test vacancies created while manually
// testing the SCRUM2-30 CV-replace fix (Sixty-first/Sixty-second passes) --
// "HR Intern", "Marketing Intern", "Finance Intern". The app deliberately
// has no hard-delete for vacancies through the UI (only "Close Vacancy" --
// see the US-22 candidate-record-retention decision earlier in the
// project), so this exists purely for cleaning up throwaway test data, the
// same category as delete-candidate-by-email.ts.
//
// Matches by a case-insensitive `contains` on title (not an exact match) --
// the real stored title for the Marketing one wasn't confirmed byte-for-
// byte, so this is deliberately forgiving about that, at the cost of also
// needing you to actually look at what it matched before it deletes
// anything.
//
// SAFETY: run once with no extra flag first -- it will only PRINT what it
// found (title, department, id, and how many applications/interviews/
// feedback rows are attached) and delete nothing. Only re-run with --yes
// once you've confirmed the printed list is exactly the vacancies you meant.
//
// Deletes, per matched vacancy, in dependency order, inside one transaction:
// FeedbackAuditLog -> Feedback -> Interview -> InterviewPanelist ->
// InterviewSlot -> ApplicationStageHistory -> StageRecommendation ->
// CandidateApplication -> VacancyInterviewer -> InterviewPanelMember ->
// InterviewPanel -> VacancyStage -> Vacancy. Does NOT touch AuditLog or
// Notification rows (permanent records / not FK-enforced against Vacancy).
//
// Run from the backend folder:
//   npx tsx scripts/delete-vacancy-by-title.ts "HR Intern" "Marketing Intern" "Finance Intern"
//   npx tsx scripts/delete-vacancy-by-title.ts "HR Intern" "Marketing Intern" "Finance Intern" --yes
import "dotenv/config";
import { prisma } from "../src/prisma.js";

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--yes");
  const titles = args.filter((a) => a !== "--yes");

  if (titles.length === 0) {
    throw new Error(
      'Usage: npx tsx scripts/delete-vacancy-by-title.ts "<title 1>" "<title 2>" ... [--yes]'
    );
  }

  const vacancies = await prisma.vacancy.findMany({
    where: { OR: titles.map((t) => ({ title: { contains: t } })) },
    include: {
      stages: true,
      panels: true,
      applications: { include: { interviews: true } },
    },
  });

  if (vacancies.length === 0) {
    console.log("No vacancies matched any of the given titles -- nothing to do.");
    return;
  }

  for (const v of vacancies) {
    const interviewIds = v.applications.flatMap((a) => a.interviews.map((i) => i.id));
    console.log(
      `[${confirm ? "DELETING" : "MATCH"}] "${v.title}" (${v.department}, id ${v.id}) -- ` +
        `${v.stages.length} stage(s), ${v.applications.length} application(s), ${interviewIds.length} interview(s)`
    );
  }

  if (!confirm) {
    console.log("\nDry run only -- re-run with --yes to actually delete the vacancies listed above.");
    return;
  }

  for (const v of vacancies) {
    const stageIds = v.stages.map((s) => s.id);
    const applicationIds = v.applications.map((a) => a.id);
    const panelIds = v.panels.map((p) => p.id);

    await prisma.$transaction(async (tx) => {
      const slots = stageIds.length > 0 ? await tx.interviewSlot.findMany({ where: { vacancyStageId: { in: stageIds } }, select: { id: true } }) : [];
      const slotIds = slots.map((s) => s.id);

      // Union interviews reachable via this vacancy's slots AND via its
      // applications directly -- covers both directions rather than
      // assuming every interview on one of these applications necessarily
      // sits in one of these slots (it always should, by business rule, but
      // this isn't DB-enforced, so don't rely on it holding).
      const interviewsViaSlots = slotIds.length > 0 ? await tx.interview.findMany({ where: { slotId: { in: slotIds } }, select: { id: true } }) : [];
      const interviewsViaApplications =
        applicationIds.length > 0 ? await tx.interview.findMany({ where: { applicationId: { in: applicationIds } }, select: { id: true } }) : [];
      const interviewIds = Array.from(new Set([...interviewsViaSlots, ...interviewsViaApplications].map((i) => i.id)));

      if (interviewIds.length > 0) {
        const feedbackRows = await tx.feedback.findMany({ where: { interviewId: { in: interviewIds } }, select: { id: true } });
        const feedbackIds = feedbackRows.map((f) => f.id);
        if (feedbackIds.length > 0) {
          await tx.feedbackAuditLog.deleteMany({ where: { feedbackId: { in: feedbackIds } } });
          await tx.feedback.deleteMany({ where: { id: { in: feedbackIds } } });
        }
        await tx.interview.deleteMany({ where: { id: { in: interviewIds } } });
      }

      if (slotIds.length > 0) {
        await tx.interviewPanelist.deleteMany({ where: { slotId: { in: slotIds } } });
        await tx.interviewSlot.deleteMany({ where: { id: { in: slotIds } } });
      }

      if (applicationIds.length > 0) {
        await tx.applicationStageHistory.deleteMany({ where: { applicationId: { in: applicationIds } } });
        await tx.stageRecommendation.deleteMany({ where: { applicationId: { in: applicationIds } } });
        await tx.candidateApplication.deleteMany({ where: { id: { in: applicationIds } } });
      }

      await tx.vacancyInterviewer.deleteMany({ where: { vacancyId: v.id } });
      if (panelIds.length > 0) {
        await tx.interviewPanelMember.deleteMany({ where: { panelId: { in: panelIds } } });
        await tx.interviewPanel.deleteMany({ where: { id: { in: panelIds } } });
      }
      await tx.vacancyStage.deleteMany({ where: { vacancyId: v.id } });
      await tx.vacancy.delete({ where: { id: v.id } });
    });

    console.log(`Deleted "${v.title}" (${v.department}).`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
