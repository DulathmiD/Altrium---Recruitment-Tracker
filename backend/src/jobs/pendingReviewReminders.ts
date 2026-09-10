// Backlog item: "As an HR officer, I want automated reminders for pending
// reviews and overdue feedback" -- distinct from interviewReminders.ts,
// which reminds about an *upcoming* scheduled interview. This nudges about
// work that's already overdue: an APPLIED application HR hasn't reviewed
// yet, and a past interview a panelist hasn't submitted feedback for.
// Deliberately reuses the exact same "pending" logic followUp.controller.ts's
// getFollowUps() already computes for HR's Follow Ups page (same APPLIED
// filter, same "past interview, feedback missing, not yet HIRED/REJECTED"
// filter) -- this cron can never disagree with what HR sees on that page,
// since it's the same underlying query, just running proactively instead of
// only on page load.
//
// Runs once a day, not every 15 minutes like interview reminders -- these
// are backlog nudges about ongoing work, not time-sensitive alerts about a
// specific upcoming slot, and something that's been pending for a week
// shouldn't re-notify every 15 minutes. Dedup is "already reminded today",
// via AuditLog (reason + recipient, filtered to entries from today) -- same
// pattern followUp.controller.ts's own wasNotified() and the seed scripts'
// sendOnceAndLog() already use, so this needed no schema change.
import cron from "node-cron";
import { prisma } from "../prisma.js";
import { Role } from "../../generated/prisma/index.js";
import { sendEmail } from "../utils/mailer.js";
import { writeAuditLog } from "../utils/auditLog.js";
import { notifyUser } from "../utils/notify.js";
import { renderTemplate } from "../utils/notificationTemplates.js";

const CHECK_CRON = "0 8 * * *"; // once a day, 08:00 server time

// How old an APPLIED application must be before HR gets nudged about it --
// an implementation default, not a separately confirmed product requirement,
// same status as VACANCY_AGE_NUDGE_DAYS in management.controller.ts.
const CV_REVIEW_NUDGE_DAYS = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// AuditLog's metadata is a JSON blob, so "have we already sent this exact
// reminder today" can't be filtered in the DB query alone -- fetched and
// matched in JS instead, same workaround as every other reason/recipient
// dedup check in this codebase.
async function alreadyRemindedToday(entityType: string, entityId: number, reason: string, recipient: string): Promise<boolean> {
  const logs = await prisma.auditLog.findMany({
    where: { entityType, entityId, action: "NOTIFICATION_SENT", createdAt: { gte: startOfToday() } },
    select: { metadata: true },
  });
  return logs.some((l) => {
    const meta = l.metadata as { reason?: string; recipient?: string } | null;
    return meta?.reason === reason && meta?.recipient === recipient;
  });
}

export async function runPendingReviewReminderCheck(): Promise<void> {
  const now = new Date();
  const cvReviewCutoff = new Date(now.getTime() - CV_REVIEW_NUDGE_DAYS * MS_PER_DAY);

  // ---- Pending CV reviews: one daily digest per active HR user ----
  try {
    const staleApplications = await prisma.candidateApplication.findMany({
      where: { stage: "APPLIED", appliedAt: { lte: cvReviewCutoff } },
      include: { candidate: true, vacancy: true },
      orderBy: { appliedAt: "asc" },
    });

    if (staleApplications.length > 0) {
      const oldest = staleApplications[0]!;
      const hrUsers = await prisma.user.findMany({ where: { role: Role.HR, isActive: true } });

      for (const hrUser of hrUsers) {
        // Keyed to entityType "User"/entityId=hrUser.id -- this reminder is a
        // rollup digest across many applications, not about any one of them,
        // so there's no single natural CandidateApplication id to attach the
        // audit entry to. Using the recipient themselves as the entity is the
        // closest fit AuditLog's (entityType, entityId) shape allows.
        if (await alreadyRemindedToday("User", hrUser.id, "pending_cv_review_reminder", hrUser.email)) continue;
        try {
          const { subject, body } = await renderTemplate("pending_cv_review_reminder", {
            userName: hrUser.name,
            count: String(staleApplications.length),
            oldestCandidateName: oldest.candidate.name,
            oldestVacancyTitle: oldest.vacancy.title,
          });
          await sendEmail({ to: hrUser.email, subject, body });
          await writeAuditLog(hrUser.id, "NOTIFICATION_SENT", "User", hrUser.id, {
            recipient: hrUser.email,
            channel: "email",
            reason: "pending_cv_review_reminder",
          });
          await notifyUser(
            hrUser.id,
            "pending_cv_review_reminder",
            `${staleApplications.length} CV review${staleApplications.length === 1 ? "" : "s"} still pending -- oldest is ${oldest.candidate.name} (${oldest.vacancy.title}).`,
            "/hr/follow-ups"
          );
        } catch (err) {
          console.error(`Pending CV review reminder: failed to notify HR user ${hrUser.email}:`, err);
        }
      }
    }
  } catch (err) {
    console.error("Pending review reminder check: could not query stale applications:", err);
  }

  // ---- Overdue feedback: nudge each panelist who hasn't submitted yet ----
  try {
    const pastInterviews = await prisma.interview.findMany({
      where: { slot: { scheduledAt: { lte: now } } },
      include: {
        slot: { include: { panelists: { include: { user: true } }, vacancyStage: true } },
        feedback: true,
        application: { include: { candidate: true, vacancy: true } },
      },
    });

    for (const iv of pastInterviews) {
      // Same exclusion as getFollowUps' pendingFeedback -- a final outcome
      // makes outstanding feedback moot.
      if (iv.application.stage === "HIRED" || iv.application.stage === "REJECTED") continue;

      const submittedByUserId = new Set(iv.feedback.map((f) => f.interviewerId));
      const pendingFrom = iv.slot.panelists.filter((p) => !submittedByUserId.has(p.userId));
      if (pendingFrom.length === 0) continue;

      const when = iv.slot.scheduledAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

      for (const panelist of pendingFrom) {
        if (await alreadyRemindedToday("Interview", iv.id, "feedback_overdue_reminder", panelist.user.email)) continue;
        try {
          const { subject, body } = await renderTemplate("feedback_overdue_reminder", {
            panelistName: panelist.user.name,
            candidateName: iv.application.candidate.name,
            vacancyTitle: iv.application.vacancy.title,
            stageLabel: iv.slot.vacancyStage.name,
            when,
          });
          await sendEmail({ to: panelist.user.email, subject, body });
          await writeAuditLog(panelist.userId, "NOTIFICATION_SENT", "Interview", iv.id, {
            recipient: panelist.user.email,
            channel: "email",
            reason: "feedback_overdue_reminder",
          });
          await notifyUser(
            panelist.userId,
            "feedback_overdue_reminder",
            `Feedback still due for ${iv.application.candidate.name} (${iv.application.vacancy.title}), interviewed ${when}.`
          );
        } catch (err) {
          console.error(`Overdue feedback reminder: failed to notify panelist ${panelist.user.email}:`, err);
        }
      }
    }
  } catch (err) {
    console.error("Pending review reminder check: could not query overdue feedback:", err);
  }
}

export function startPendingReviewReminderJob(): void {
  cron.schedule(CHECK_CRON, () => {
    runPendingReviewReminderCheck().catch((err) => {
      console.error("Pending review reminder job crashed:", err);
    });
  });
  console.log(`Pending review reminder job scheduled (${CHECK_CRON}, daily digest).`);
}
