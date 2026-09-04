import type { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { sendEmail } from "../utils/mailer.js";
import { writeAuditLog } from "../utils/auditLog.js";
import { notifyUser } from "../utils/notify.js";

// US-26/US-29, locked interpretation (see decision log): two independent
// follow-up types, both derived on read -- nothing is stored as "pending",
// it's computed fresh every time this endpoint is called.
//
// Pending CV Review: a CandidateApplication still at APPLIED. Immediate, no
// grace period, no separate "overdue" state -- resolves the instant HR
// shortlists or rejects it. No email action attached (locked via chat: HR is
// both the actor and the reviewer here, there's no one else to remind).
//
// Pending Feedback: an Interview whose scheduledAt has passed where at least
// one assigned panelist hasn't submitted Feedback yet. Resolves per-panelist
// as each one submits. Removed from the active list once the application
// reaches a final outcome (HIRED or REJECTED) -- user's stated reasoning was
// specifically that HIRED "won't happen" while feedback is outstanding
// (HM only advances based on submitted feedback), but the ADVANCE endpoint
// doesn't actually enforce that server-side, so this is a defensive
// completeness check, not expected to trigger in normal use.
export async function getFollowUps(req: Request, res: Response) {
  try {
    const pendingApplications = await prisma.candidateApplication.findMany({
      where: { stage: "APPLIED" },
      include: { candidate: true, vacancy: true },
      orderBy: { appliedAt: "asc" },
    });

    // Schema split Interview into InterviewSlot (time/panel/round) +
    // Interview (one candidate's participation) -- scheduledAt/panelists/
    // vacancyStage now live on `.slot`. See schema.prisma.
    const pastInterviews = await prisma.interview.findMany({
      where: { slot: { scheduledAt: { lte: new Date() } } },
      include: {
        slot: { include: { panelists: { include: { user: true } }, vacancyStage: true } },
        feedback: true,
        application: { include: { candidate: true, vacancy: true } },
      },
      orderBy: { slot: { scheduledAt: "asc" } },
    });

    const pendingFeedback = pastInterviews
      .filter((iv) => iv.application.stage !== "HIRED" && iv.application.stage !== "REJECTED")
      .map((iv) => {
        const submittedByUserId = new Set(iv.feedback.map((f) => f.interviewerId));
        const pendingFrom = iv.slot.panelists.filter((p) => !submittedByUserId.has(p.userId));
        return { interview: iv, pendingFrom };
      })
      .filter((row) => row.pendingFrom.length > 0)
      .map((row) => ({
        interviewId: row.interview.id,
        scheduledAt: row.interview.slot.scheduledAt,
        candidate: { id: row.interview.application.candidate.id, name: row.interview.application.candidate.name },
        vacancy: {
          id: row.interview.application.vacancy.id,
          title: row.interview.application.vacancy.title,
          status: row.interview.application.vacancy.status,
        },
        round: {
          id: row.interview.slot.vacancyStage.id,
          name: row.interview.slot.vacancyStage.name,
          order: row.interview.slot.vacancyStage.order,
          roundLabel: row.interview.slot.roundLabel,
        },
        pendingFrom: row.pendingFrom.map((p) => ({ id: p.user.id, name: p.user.name, email: p.user.email })),
      }));

    // Interview Invites (Candidates + Interviewers): round 2+ interviews
    // where the round-1-only auto-invite (see scheduleInterview() in
    // interview.controller.ts) never fired -- HR sends it manually from here
    // instead, to the candidate and/or to each panelist who hasn't been
    // notified yet. "Already sent" is derived from the NOTIFICATION_SENT
    // audit log rather than a stored flag -- both the automatic and manual
    // send paths write the same reason string, so a manual send here is
    // indistinguishable from an automatic one for this check. No time window
    // and not stage-filtered by past/future -- sorted soonest-first like
    // everything else on this page.
    const laterRoundInterviews = await prisma.interview.findMany({
      where: { slot: { vacancyStage: { order: { gt: 1 } } } },
      include: {
        slot: { include: { vacancyStage: true, panelists: { include: { user: true } } } },
        application: { include: { candidate: true, vacancy: true } },
      },
      orderBy: { slot: { scheduledAt: "asc" } },
    });

    const laterRoundNotificationLogs = await prisma.auditLog.findMany({
      where: {
        action: "NOTIFICATION_SENT",
        entityType: "Interview",
        entityId: { in: laterRoundInterviews.map((iv) => iv.id) },
      },
      select: { entityId: true, metadata: true },
    });

    function wasNotified(interviewId: number, reason: string, recipient: string) {
      return laterRoundNotificationLogs.some(
        (log) =>
          log.entityId === interviewId &&
          (log.metadata as any)?.reason === reason &&
          (log.metadata as any)?.recipient === recipient
      );
    }

    const activeLaterRoundInterviews = laterRoundInterviews.filter(
      (iv) => iv.application.stage !== "HIRED" && iv.application.stage !== "REJECTED"
    );

    const pendingInvites = activeLaterRoundInterviews
      .filter((iv) => !wasNotified(iv.id, "interview_scheduled_candidate", iv.application.candidate.email))
      .map((iv) => ({
        interviewId: iv.id,
        scheduledAt: iv.slot.scheduledAt,
        candidate: { id: iv.application.candidate.id, name: iv.application.candidate.name, email: iv.application.candidate.email },
        vacancy: { id: iv.application.vacancy.id, title: iv.application.vacancy.title },
        round: { id: iv.slot.vacancyStage.id, name: iv.slot.vacancyStage.name, order: iv.slot.vacancyStage.order, roundLabel: iv.slot.roundLabel },
      }));

    const pendingPanelistInvites = activeLaterRoundInterviews
      .map((iv) => ({
        iv,
        pendingFrom: iv.slot.panelists.filter((p) => !wasNotified(iv.id, "interview_scheduled_panelist", p.user.email)),
      }))
      .filter((row) => row.pendingFrom.length > 0)
      .map((row) => ({
        interviewId: row.iv.id,
        scheduledAt: row.iv.slot.scheduledAt,
        candidate: { id: row.iv.application.candidate.id, name: row.iv.application.candidate.name },
        vacancy: { id: row.iv.application.vacancy.id, title: row.iv.application.vacancy.title },
        round: {
          id: row.iv.slot.vacancyStage.id,
          name: row.iv.slot.vacancyStage.name,
          order: row.iv.slot.vacancyStage.order,
          roundLabel: row.iv.slot.roundLabel,
        },
        pendingFrom: row.pendingFrom.map((p) => ({ id: p.user.id, name: p.user.name, email: p.user.email })),
      }));

    // Upcoming Calls: candidates with a future-dated interview, so HR has a
    // one-stop list of who to ring ahead of their slot. No time window (e.g.
    // "within 3 days") -- computed on read like everything else on this page,
    // sorted soonest-first. Excludes REJECTED/HIRED for the same reason
    // pendingFeedback does (a final outcome makes the upcoming slot moot,
    // though in practice a slot in the future for a decided application
    // shouldn't happen).
    const futureInterviews = await prisma.interview.findMany({
      where: { slot: { scheduledAt: { gt: new Date() } } },
      include: {
        slot: { include: { vacancyStage: true } },
        application: { include: { candidate: true, vacancy: true } },
      },
      orderBy: { slot: { scheduledAt: "asc" } },
    });

    const upcomingCalls = futureInterviews
      .filter((iv) => iv.application.stage !== "HIRED" && iv.application.stage !== "REJECTED")
      .map((iv) => ({
        interviewId: iv.id,
        scheduledAt: iv.slot.scheduledAt,
        candidate: {
          id: iv.application.candidate.id,
          name: iv.application.candidate.name,
          phoneNumber: iv.application.candidate.phoneNumber,
        },
        vacancy: { id: iv.application.vacancy.id, title: iv.application.vacancy.title },
        round: { id: iv.slot.vacancyStage.id, name: iv.slot.vacancyStage.name, order: iv.slot.vacancyStage.order },
      }));

    res.json({
      pendingCvReviews: pendingApplications.map((app) => ({
        applicationId: app.id,
        candidate: { id: app.candidate.id, name: app.candidate.name, email: app.candidate.email },
        vacancy: { id: app.vacancy.id, title: app.vacancy.title, department: app.vacancy.department },
        appliedAt: app.appliedAt,
      })),
      pendingFeedback,
      pendingInvites,
      pendingPanelistInvites,
      upcomingCalls,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build follow-ups list" });
  }
}

// Manual-only reminder to one specific interviewer who hasn't submitted
// feedback yet. HR composes/edits the final subject+body client-side (the
// "fixed template, editable before send" flow lives in the frontend) --
// this endpoint just sends exactly what it's given and audit-logs it.
export async function sendFeedbackReminder(req: Request, res: Response) {
  const interviewId = Number(req.params.id);
  const userId = Number(req.params.userId);
  if (Number.isNaN(interviewId) || Number.isNaN(userId)) {
    return res.status(400).json({ error: "Invalid interview or user id" });
  }

  const { subject, message } = req.body as { subject?: string; message?: string };
  if (!subject || !subject.trim() || !message || !message.trim()) {
    return res.status(400).json({ error: "subject and message are required" });
  }

  try {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { slot: { include: { panelists: { include: { user: true } } } }, feedback: true },
    });
    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    const panelist = interview.slot.panelists.find((p) => p.userId === userId);
    if (!panelist) {
      return res.status(400).json({ error: "This user is not a panelist on this interview" });
    }

    const alreadySubmitted = interview.feedback.some((f) => f.interviewerId === userId);
    if (alreadySubmitted) {
      return res.status(400).json({ error: "This panelist has already submitted feedback - nothing to remind" });
    }

    await sendEmail({ to: panelist.user.email, subject: subject.trim(), body: message.trim() });
    await writeAuditLog(req.user!.id, "NOTIFICATION_SENT", "Interview", interviewId, {
      recipient: panelist.user.email,
      channel: "email",
      reason: "manual_feedback_reminder",
    });
    await notifyUser(userId, "manual_feedback_reminder", `Reminder: ${subject.trim()}`);

    res.status(200).json({ sent: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not send reminder" });
  }
}

// Manual counterpart to the round-1 auto-invite: sends the candidate-facing
// "your interview has been scheduled" email for a round 2+ interview. Writes
// the exact same NOTIFICATION_SENT reason ("interview_scheduled_candidate")
// as the automatic round-1 send, so this interview then correctly drops out
// of the pendingInvites list above regardless of which path sent it.
export async function sendCandidateInvite(req: Request, res: Response) {
  const interviewId = Number(req.params.id);
  if (Number.isNaN(interviewId)) {
    return res.status(400).json({ error: "Invalid interview id" });
  }

  const { subject, message } = req.body as { subject?: string; message?: string };
  if (!subject || !subject.trim() || !message || !message.trim()) {
    return res.status(400).json({ error: "subject and message are required" });
  }

  try {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { application: { include: { candidate: true } } },
    });
    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    await sendEmail({ to: interview.application.candidate.email, subject: subject.trim(), body: message.trim() });
    await writeAuditLog(req.user!.id, "NOTIFICATION_SENT", "Interview", interviewId, {
      recipient: interview.application.candidate.email,
      channel: "email",
      reason: "interview_scheduled_candidate",
    });

    res.status(200).json({ sent: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not send invite" });
  }
}

// Manual counterpart to the round-1 auto-notify for a single panelist on a
// round 2+ interview. Same "interview_scheduled_panelist" reason string as
// the automatic send, keyed to this one panelist's email, so it clears just
// that panelist's entry out of pendingPanelistInvites above.
export async function sendPanelistInterviewInvite(req: Request, res: Response) {
  const interviewId = Number(req.params.id);
  const userId = Number(req.params.userId);
  if (Number.isNaN(interviewId) || Number.isNaN(userId)) {
    return res.status(400).json({ error: "Invalid interview or user id" });
  }

  const { subject, message } = req.body as { subject?: string; message?: string };
  if (!subject || !subject.trim() || !message || !message.trim()) {
    return res.status(400).json({ error: "subject and message are required" });
  }

  try {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { slot: { include: { panelists: { include: { user: true } } } } },
    });
    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    const panelist = interview.slot.panelists.find((p) => p.userId === userId);
    if (!panelist) {
      return res.status(400).json({ error: "This user is not a panelist on this interview" });
    }

    await sendEmail({ to: panelist.user.email, subject: subject.trim(), body: message.trim() });
    await writeAuditLog(req.user!.id, "NOTIFICATION_SENT", "Interview", interviewId, {
      recipient: panelist.user.email,
      channel: "email",
      reason: "interview_scheduled_panelist",
    });
    await notifyUser(userId, "interview_scheduled_panelist", subject.trim());

    res.status(200).json({ sent: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not send invite" });
  }
}
