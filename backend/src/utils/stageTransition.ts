import { prisma } from "../prisma.js";
import type { RecruitmentStage } from "../../generated/prisma/index.js";

// Human-readable labels for emails/PDF/UI -- the enum values themselves are
// SCREAMING_SNAKE_CASE, not meant to be shown to users directly.
export const STAGE_LABELS: Record<RecruitmentStage, string> = {
  APPLIED: "Applied",
  SHORTLISTED: "Shortlisted",
  INTERVIEW_1: "Interview 1",
  INTERVIEW_2: "Interview 2",
  FINAL_INTERVIEW: "Final Interview",
  HIRED: "Hired",
  REJECTED: "Rejected",
};

// Rank order for "no skipping, no moving backwards" enforcement. REJECTED is
// deliberately excluded -- it's reachable from any rank, not part of the
// forward sequence.
export const STAGE_RANK: Record<Exclude<RecruitmentStage, "REJECTED">, number> = {
  APPLIED: 0,
  SHORTLISTED: 1,
  INTERVIEW_1: 2,
  INTERVIEW_2: 3,
  FINAL_INTERVIEW: 4,
  HIRED: 5,
};

// Called once, right after a CandidateApplication row is created. Opens the
// first stage-history entry (APPLIED, no prior entry to close out).
export async function initializeApplicationStage(applicationId: number, userId: number | null) {
  await prisma.applicationStageHistory.create({
    data: {
      applicationId,
      stage: "APPLIED",
      changedByUserId: userId,
    },
  });
}

// Called on every subsequent stage change. Closes out whatever history entry
// is currently open (exitedAt: null) and opens a new one for the new stage,
// then updates CandidateApplication.stage itself -- all atomically.
export async function transitionApplicationStage(
  applicationId: number,
  newStage: RecruitmentStage,
  userId: number | null,
  extraData: Record<string, unknown> = {}
) {
  const now = new Date();

  const openEntry = await prisma.applicationStageHistory.findFirst({
    where: { applicationId, exitedAt: null },
    orderBy: { enteredAt: "desc" },
  });

  const operations = [
    ...(openEntry
      ? [
          prisma.applicationStageHistory.update({
            where: { id: openEntry.id },
            data: { exitedAt: now },
          }),
        ]
      : []),
    prisma.applicationStageHistory.create({
      data: {
        applicationId,
        stage: newStage,
        enteredAt: now,
        changedByUserId: userId,
      },
    }),
    prisma.candidateApplication.update({
      where: { id: applicationId },
      data: { stage: newStage, ...extraData },
      include: { candidate: true, vacancy: true, decidedBy: true, hiringManager: true },
    }),
  ];

  const results = await prisma.$transaction(operations);
  // The candidateApplication.update is always the last operation in the array,
  // regardless of whether the conditional "close open entry" step ran.
  return results[results.length - 1];
}
