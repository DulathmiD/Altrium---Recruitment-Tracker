import { prisma } from "../prisma.js";
import type { RecruitmentStage } from "../../generated/prisma/index.js";
import { renameFile } from "./fileStorage.js";

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

// CV archiving (organisational separation, not deletion -- see decision log):
// a candidate's CV file is shared across all of their applications (Candidate
// stores one cvUrl, not each CandidateApplication), so it's only moved into
// the "rejected/" prefix once EVERY application this candidate has is
// REJECTED -- if they're still active on another vacancy, moving the shared
// file would break that other application's CV lookup. Reconsidering an
// application back to APPLIED (the one path back out of REJECTED, see
// application.controller.ts's updateApplicationStatus) always restores the
// file, since that unconditionally makes the candidate active again.
const REJECTED_CV_PREFIX = "rejected/";

async function archiveCvIfCandidateFullyRejected(candidateId: number): Promise<void> {
  const activeElsewhere = await prisma.candidateApplication.count({
    where: { candidateId, stage: { not: "REJECTED" } },
  });
  if (activeElsewhere > 0) return;

  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId }, select: { cvUrl: true } });
  if (!candidate?.cvUrl || candidate.cvUrl.startsWith(REJECTED_CV_PREFIX)) return;

  const archivedKey = `${REJECTED_CV_PREFIX}${candidate.cvUrl}`;
  try {
    await renameFile(candidate.cvUrl, archivedKey);
    await prisma.candidate.update({ where: { id: candidateId }, data: { cvUrl: archivedKey } });
  } catch (err) {
    // Never let archiving failure block the actual stage transition it's
    // attached to -- worst case the CV stays in its current location.
    console.error(`Could not archive CV for candidate ${candidateId}:`, err);
  }
}

async function restoreCvFromArchive(candidateId: number): Promise<void> {
  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId }, select: { cvUrl: true } });
  if (!candidate?.cvUrl || !candidate.cvUrl.startsWith(REJECTED_CV_PREFIX)) return;

  const restoredKey = candidate.cvUrl.slice(REJECTED_CV_PREFIX.length);
  try {
    await renameFile(candidate.cvUrl, restoredKey);
    await prisma.candidate.update({ where: { id: candidateId }, data: { cvUrl: restoredKey } });
  } catch (err) {
    console.error(`Could not restore archived CV for candidate ${candidateId}:`, err);
  }
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
  // regardless of whether the conditional "close open entry" step ran. Not
  // narrowing/casting this -- existing callers rely on its full inferred
  // shape (stage, vacancy, candidate, etc.), so only read the one field CV
  // archiving needs off a separate reference, and return the original as-is.
  const updatedApplication = results[results.length - 1];
  const candidateId = (updatedApplication as { candidateId: number }).candidateId;

  // CV archiving runs after the transaction commits (file storage isn't
  // transactional with the DB anyway) and only reacts to anchor-stage moves,
  // not interview-round moves (vacancyStageId updates leave `stage` alone).
  if ("stage" in update) {
    if (update.stage === "REJECTED") {
      await archiveCvIfCandidateFullyRejected(candidateId);
    } else if (update.stage === "APPLIED") {
      // The only route back to APPLIED is Reconsider, out of REJECTED.
      await restoreCvFromArchive(candidateId);
    }
  }

  return updatedApplication;
}
