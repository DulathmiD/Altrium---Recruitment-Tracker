import { prisma } from "../prisma.js";
import type { RecruitmentStage } from "../../generated/prisma/index.js";

// The 4 fixed pipeline anchors (US-05 redesign). Interview rounds are no
// longer part of this enum -- they're HR-configurable per vacancy via
// VacancyStage, and a round's own `name` field is already human-readable
// (no label lookup needed for those, unlike these 4 fixed values).
export const ANCHOR_STAGES: RecruitmentStage[] = ["APPLIED", "SHORTLISTED", "HIRED", "REJECTED"];

export const ANCHOR_STAGE_LABELS: Record<RecruitmentStage, string> = {
  APPLIED: "Applied",
  SHORTLISTED: "Shortlisted",
  HIRED: "Hired",
  REJECTED: "Rejected",
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

export type StageUpdate = { stage: RecruitmentStage } | { vacancyStageId: number };

// Called on every subsequent stage change -- either an anchor transition
// (APPLIED/SHORTLISTED/HIRED/REJECTED, sets CandidateApplication.stage) or an
// interview-round transition (sets CandidateApplication.currentVacancyStageId,
// leaves `stage` untouched -- it stays SHORTLISTED while a candidate moves
// through interview rounds, only HIRED/REJECTED change it again). Closes out
// whatever history entry is currently open (exitedAt: null) and opens a new
// one, then updates CandidateApplication itself -- all atomically.
export async function transitionApplicationStage(
  applicationId: number,
  update: StageUpdate,
  userId: number | null,
  extraData: Record<string, unknown> = {}
) {
  const now = new Date();

  const openEntry = await prisma.applicationStageHistory.findFirst({
    where: { applicationId, exitedAt: null },
    orderBy: { enteredAt: "desc" },
  });

  const applicationData =
    "stage" in update
      ? { stage: update.stage, ...extraData }
      : { currentVacancyStageId: update.vacancyStageId, ...extraData };

  const historyData =
    "stage" in update
      ? { applicationId, stage: update.stage, enteredAt: now, changedByUserId: userId }
      : { applicationId, vacancyStageId: update.vacancyStageId, enteredAt: now, changedByUserId: userId };

  const operations = [
    ...(openEntry
      ? [
          prisma.applicationStageHistory.update({
            where: { id: openEntry.id },
            data: { exitedAt: now },
          }),
        ]
      : []),
    prisma.applicationStageHistory.create({ data: historyData }),
    prisma.candidateApplication.update({
      where: { id: applicationId },
      data: applicationData,
      include: {
        candidate: true,
        vacancy: true,
        decidedBy: true,
        hiringManager: true,
        currentVacancyStage: true,
      },
    }),
  ];

  const results = await prisma.$transaction(operations);
  // The candidateApplication.update is always the last operation in the array,
  // regardless of whether the conditional "close open entry" step ran.
  return results[results.length - 1];
}
