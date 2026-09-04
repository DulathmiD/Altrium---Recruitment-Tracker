// SCRUM2-29: interview reminder emails, sent automatically ahead of the
// scheduled time -- distinct from the existing "interview scheduled" invite
// (US-12, sent once at booking time). This is a real background job, not an
// HR-triggered send, per the explicit design choice to make this one
// literally automatic (see decision log).
//
// Defaults (not a locked product requirement, just a reasonable starting
// point -- both easy to change here if the team wants a different window):
//   - reminder fires once, between 24h and 24h15m before the interview
//     (whatever the next cron tick after crossing the 24h mark catches)
//   - checked every 15 minutes
import cron from "node-cron";
import { prisma } from "../prisma.js";
import { sendEmail } from "../utils/mailer.js";
import { writeAuditLog } from "../utils/auditLog.js";
import { notifyUser } from "../utils/notify.js";
import { renderTemplate } from "../utils/notificationTemplates.js";

const REMINDER_WINDOW_HOURS = 24;
const CHECK_INTERVAL_CRON = "*/15 * * * *";

export async function runInterviewReminderCheck(): Promise<void> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

  let slots;
  try {
    slots = await prisma.interviewSlot.findMany({
      where: {
        scheduledAt: { gte: now, lte: windowEnd },
        reminderSentAt: null,
      },
      include: {
        vacancyStage: true,
        panelists: { include: { user: true } },
        interviews: { include: { application: { include: { candidate: true, vacancy: true } } } },
      },
    });
  } catch (err) {
    console.error("Interview reminder check: could not query upcoming slots:", err);
    return;
  }

  for (const slot of slots) {
    const firstInterview = slot.interviews[0];
    if (!firstInterview) {
      // A slot with no candidates yet (e.g. created but candidates not added)
      // has nothing to remind anyone about -- leave reminderSentAt null so
      // it's picked up once a candidate is actually added, if that happens
      // before the interview time passes out of the window.
      continue;
    }

    const when = slot.scheduledAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
    const stageLabel = slot.vacancyStage.name;
    const vacancyTitle = firstInterview.application.vacancy.title;

    const candidateNames = slot.interviews.map((iv) => iv.application.candidate.name);
    const combinedCandidateName = candidateNames.join(", ");
    const combinedCvUrl = slot.interviews
      .map((iv) => `${iv.application.candidate.name}: ${iv.application.candidate.cvUrl}`)
      .join(" | ");

    // One combined reminder per panelist, even if several candidates share
    // this slot -- looping per-interview here would email each panelist once
    // per candidate in the slot, which is a duplicate send, not a reminder.
    for (const panelist of slot.panelists) {
      try {
        const { subject, body } = await renderTemplate("interview_reminder_panelist", {
          panelistName: panelist.user.name,
          candidateName: combinedCandidateName,
          vacancyTitle,
          stageLabel,
          when,
          cvUrl: combinedCvUrl,
        });
        await sendEmail({ to: panelist.user.email, subject, body });
        await writeAuditLog(panelist.userId, "NOTIFICATION_SENT", "InterviewSlot", slot.id, {
          recipient: panelist.user.email,
          channel: "email",
          reason: "interview_reminder_panelist",
        });
        await notifyUser(
          panelist.user.id,
          "interview_reminder_panelist",
          `Reminder: you're interviewing ${combinedCandidateName} for ${vacancyTitle} (${stageLabel}) on ${when}.`
        );
      } catch (err) {
        console.error(`Interview reminder: failed to notify panelist ${panelist.user.email}:`, err);
      }
    }

    // AuditLog.userId is NOT NULL (it records "who performed the action"),
    // but this job has no human actor. Reuses the first panelist's id as the
    // closest available "responsible" user for the slot -- if a slot
    // somehow has zero panelists, the email still sends, it just isn't
    // audit-logged (no valid actor id to attribute it to, and there's no
    // seeded "system" user in this schema to fall back to).
    const auditActorId = slot.panelists[0]?.userId;

    // One reminder per candidate in the slot.
    for (const interview of slot.interviews) {
      const candidate = interview.application.candidate;
      try {
        const { subject, body } = await renderTemplate("interview_reminder_candidate", {
          candidateName: candidate.name,
          vacancyTitle,
          stageLabel,
          when,
        });
        await sendEmail({ to: candidate.email, subject, body });
        if (auditActorId !== undefined) {
          await writeAuditLog(auditActorId, "NOTIFICATION_SENT", "InterviewSlot", slot.id, {
            recipient: candidate.email,
            channel: "email",
            reason: "interview_reminder_candidate",
          });
        }
      } catch (err) {
        console.error(`Interview reminder: failed to notify candidate ${candidate.email}:`, err);
      }
    }

    // Marked sent regardless of individual send failures above (same
    // "don't block/retry-storm on email failure" contract as every other
    // sendEmail() call site in this app) -- a slot that fails once won't be
    // retried every 15 minutes forever.
    try {
      await prisma.interviewSlot.update({ where: { id: slot.id }, data: { reminderSentAt: now } });
    } catch (err) {
      console.error(`Interview reminder: failed to mark slot ${slot.id} as reminded:`, err);
    }
  }
}

export function startInterviewReminderJob(): void {
  cron.schedule(CHECK_INTERVAL_CRON, () => {
    runInterviewReminderCheck().catch((err) => {
      console.error("Interview reminder job crashed:", err);
    });
  });
  console.log(`Interview reminder job scheduled (${CHECK_INTERVAL_CRON}, ${REMINDER_WINDOW_HOURS}h window).`);
}
