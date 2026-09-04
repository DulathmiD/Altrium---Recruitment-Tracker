import type { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { sendEmail } from "../utils/mailer.js";
import { writeAuditLog } from "../utils/auditLog.js";
import { renderTemplate } from "../utils/notificationTemplates.js";
import { notifyUser } from "../utils/notify.js";

// Frontend-corrections pass: schema split Interview into InterviewSlot (the
// calendar entry -- time/round/panel/HR's optional round label) + Interview
// (one candidate's participation in a slot). See schema.prisma for the full
// reasoning. Every function below that reads vacancyStage/scheduledAt/
// panelists off an Interview flattens them back out of `.slot` immediately
// after the query, so the JSON shape returned to the frontend (and to
// existing callers like CandidatesPage's quick single-candidate schedule
// flow) is unchanged -- only the internal query path changed.
function flattenInterview<
  T extends {
    slot: {
      vacancyStageId: number;
      scheduledAt: Date;
      roundLabel: string | null;
      vacancyStage: unknown;
      panelists: unknown[];
    };
  }
>(interview: T) {
  const { slot, ...rest } = interview;
  return {
    ...rest,
    vacancyStageId: slot.vacancyStageId,
    scheduledAt: slot.scheduledAt,
    roundLabel: slot.roundLabel,
    vacancyStage: slot.vacancyStage,
    panelists: slot.panelists,
  };
}

// US-10/US-11 checks shared by both the legacy one-step scheduleInterview
// and the new createInterviewSlot -- kept as one function so the two entry
// points can't drift and start enforcing different rules.
async function validatePanelistsAndConflict(
  vacancyId: number,
  panelistUserIds: number[],
  scheduledDate: Date
): Promise<{ error: string; status: number } | null> {
  // Corrections doc: interviewers can only be scheduled 9:00 AM-5:00 PM.
  // Enforced server-side (not just via the frontend's hour dropdown) so the
  // rule holds no matter which client/entry point is used.
  const hour = scheduledDate.getHours();
  const minute = scheduledDate.getMinutes();
  const minutesSinceMidnight = hour * 60 + minute;
  if (minutesSinceMidnight < 9 * 60 || minutesSinceMidnight > 17 * 60) {
    return { status: 400, error: "Interviews can only be scheduled between 9:00 AM and 5:00 PM." };
  }

  const assignedInterviewers = await prisma.vacancyInterviewer.findMany({
    where: { vacancyId, userId: { in: panelistUserIds } },
  });
  if (assignedInterviewers.length !== panelistUserIds.length) {
    return {
      status: 400,
      error: "One or more panelists are not assigned to this vacancy. Assign them via POST /vacancies/:id/interviewers first.",
    };
  }

  const conflicting = await prisma.interviewSlot.findFirst({
    where: {
      scheduledAt: scheduledDate,
      panelists: { some: { userId: { in: panelistUserIds } } },
    },
    include: { panelists: { include: { user: true } } },
  });
  if (conflicting) {
    const conflictingNames = conflicting.panelists
      .filter((p) => panelistUserIds.includes(p.userId))
      .map((p) => p.user.name)
      .join(", ");
    return {
      status: 409,
      error: `Scheduling conflict: ${conflictingNames} already has another interview at this exact time`,
    };
  }

  return null;
}

// Corrections doc: "THE MANAGEMENT HAS TO ATTEND THE LAST INTERVIEW" -- an
// enforced rule (confirmed via AskUserQuestion), not just a UI nudge. Blocks
// scheduling a vacancy's final configured round unless at least one assigned
// panelist has the MANAGEMENT role. Shared by both scheduling entry points
// for the same reason validatePanelistsAndConflict is shared -- one place so
// they can't drift.
async function checkFinalRoundHasManagement(
  vacancyId: number,
  roundOrder: number,
  panelistUserIds: number[]
): Promise<{ error: string; status: number } | null> {
  const lastRound = await prisma.vacancyStage.findFirst({
    where: { vacancyId },
    orderBy: { order: "desc" },
  });
  if (!lastRound || lastRound.order !== roundOrder) return null; // not the final round -- rule doesn't apply

  const panelists = await prisma.user.findMany({
    where: { id: { in: panelistUserIds } },
    select: { role: true },
  });
  const hasManagement = panelists.some((u) => u.role === "MANAGEMENT");
  if (!hasManagement) {
    return {
      status: 400,
      error: "The final interview round must include at least one Management panelist.",
    };
  }
  return null;
}

// Legacy one-step flow, kept working exactly as before for CandidatesPage's
// inline "Schedule Interview" action on a single candidate (task #3) --
// internally now creates an InterviewSlot + one Interview row in the same
// transaction instead of one Interview row directly. Response shape is
// unchanged (flattenInterview puts vacancyStage/scheduledAt/panelists back
// on the top-level object).
export async function scheduleInterview(req: Request, res: Response) {
  const applicationId = Number(req.params.id);
  if (Number.isNaN(applicationId)) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  const { vacancyStageId, scheduledAt, panelistUserIds } = req.body as {
    vacancyStageId?: number;
    scheduledAt?: string;
    panelistUserIds?: number[];
  };

  if (!vacancyStageId || !scheduledAt || !panelistUserIds || panelistUserIds.length === 0) {
    return res
      .status(400)
      .json({ error: "vacancyStageId, scheduledAt, and at least one panelistUserIds entry are required" });
  }

  try {
    const application = await prisma.candidateApplication.findUnique({ where: { id: applicationId } });
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Candidate must be shortlisted (or already progressing through interview
    // rounds) before an interview can be scheduled -- under the US-05 model
    // `stage` stays SHORTLISTED for the entire interview phase (only
    // currentVacancyStageId changes as they move between rounds), so a single
    // stage check covers both "just shortlisted" and "already mid-interview."
    // Blocks scheduling for a still-APPLIED (not yet reviewed) or already
    // finalized (HIRED/REJECTED) application.
    if (application.stage !== "SHORTLISTED") {
      return res.status(400).json({
        error: "Candidate must be shortlisted (or already in an interview round) before an interview can be scheduled",
      });
    }

    // The round being scheduled must actually belong to this application's
    // vacancy -- rounds are per-vacancy under the US-05 redesign, so a
    // vacancyStageId from a different vacancy is invalid here even if it
    // exists in the DB.
    const round = await prisma.vacancyStage.findUnique({ where: { id: vacancyStageId } });
    if (!round || round.vacancyId !== application.vacancyId) {
      return res.status(400).json({ error: "vacancyStageId does not belong to this application's vacancy" });
    }

    const scheduledDate = new Date(scheduledAt);
    const conflict = await validatePanelistsAndConflict(application.vacancyId, panelistUserIds, scheduledDate);
    if (conflict) {
      return res.status(conflict.status).json({ error: conflict.error });
    }
    const managementCheck = await checkFinalRoundHasManagement(application.vacancyId, round.order, panelistUserIds);
    if (managementCheck) {
      return res.status(managementCheck.status).json({ error: managementCheck.error });
    }

    const interview = await prisma.$transaction(async (tx) => {
      const slot = await tx.interviewSlot.create({
        data: {
          vacancyStageId,
          scheduledAt: scheduledDate,
          panelists: { create: panelistUserIds.map((userId) => ({ userId })) },
        },
      });
      return tx.interview.create({
        data: { slotId: slot.id, applicationId },
        include: {
          application: { include: { candidate: true, vacancy: true } },
          slot: {
            include: {
              panelists: { include: { user: true } },
              vacancyStage: true,
            },
          },
        },
      });
    });

    await writeAuditLog(req.user!.id, "INTERVIEW_SCHEDULED", "Interview", interview.id, {
      applicationId,
      round: interview.slot.vacancyStage.name,
      // Json metadata fields need plain JSON-safe values -- a raw Date object
      // fails Prisma's runtime validation for Json input, unlike every other
      // audit call in this codebase which only ever passes strings/numbers.
      scheduledAt: interview.slot.scheduledAt.toISOString(),
    });

    // Email failures must never block the scheduling action itself -- log and move on.
    // Audit-logging a notification only happens on a successful send, per email, so a
    // partial failure (e.g. one panelist's email bounces) is reflected accurately.
    try {
      const { candidate, vacancy } = interview.application;
      const stageLabel = interview.slot.vacancyStage.name;
      const when = interview.slot.scheduledAt.toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      });

      // Both the panelist and candidate invite emails are only automatic for
      // round 1 (locked via chat: round 1 fires right away same as before;
      // round 2+ is a deliberate manual step HR triggers from the Follow Ups
      // "Interview Invites - Interviewers"/"- Candidates" sections instead --
      // see sendPanelistInterviewInvite()/sendCandidateInvite() in
      // followUp.controller.ts, which reuse these exact reason strings so the
      // Follow Ups query can detect "already sent" regardless of which path
      // sent it).
      if (interview.slot.vacancyStage.order === 1) {
        for (const panelist of interview.slot.panelists) {
          const { subject, body } = await renderTemplate("interview_scheduled_panelist", {
            panelistName: panelist.user.name,
            candidateName: candidate.name,
            vacancyTitle: vacancy.title,
            stageLabel,
            when,
            cvUrl: candidate.cvUrl,
          });
          await sendEmail({ to: panelist.user.email, subject, body });
          await writeAuditLog(req.user!.id, "NOTIFICATION_SENT", "Interview", interview.id, {
            recipient: panelist.user.email,
            channel: "email",
            reason: "interview_scheduled_panelist",
          });
          await notifyUser(
            panelist.user.id,
            "interview_scheduled_panelist",
            `You've been assigned to interview ${candidate.name} for ${vacancy.title} (${stageLabel}) on ${when}.`
          );
        }

        const candidateEmail = await renderTemplate("interview_scheduled_candidate", {
          candidateName: candidate.name,
          vacancyTitle: vacancy.title,
          stageLabel,
          when,
        });
        await sendEmail({ to: candidate.email, subject: candidateEmail.subject, body: candidateEmail.body });
        await writeAuditLog(req.user!.id, "NOTIFICATION_SENT", "Interview", interview.id, {
          recipient: candidate.email,
          channel: "email",
          reason: "interview_scheduled_candidate",
        });
      }
    } catch (emailErr) {
      console.error("Interview scheduled but notification email(s) failed:", emailErr);
    }

    res.status(201).json(flattenInterview(interview));
  } catch (err: any) {
    if (err.code === "P2003") {
      return res.status(404).json({ error: "Application or one of the panelists was not found" });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Duplicate panelist in the list" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not schedule interview" });
  }
}

// New primitive (foundation for the HR Interviews calendar module): create a
// slot -- time, round, panel, HR's optional free-text round label -- with no
// candidates attached yet. Matches the wireframe's "+" menu having separate
// "assign an interview panel" / "schedule an interview" / "add a candidate"
// options, rather than one combined action.
export async function createInterviewSlot(req: Request, res: Response) {
  const { vacancyStageId, scheduledAt, panelistUserIds, roundLabel } = req.body as {
    vacancyStageId?: number;
    scheduledAt?: string;
    panelistUserIds?: number[];
    roundLabel?: string;
  };

  if (!vacancyStageId || !scheduledAt || !panelistUserIds || panelistUserIds.length === 0) {
    return res
      .status(400)
      .json({ error: "vacancyStageId, scheduledAt, and at least one panelistUserIds entry are required" });
  }

  try {
    const round = await prisma.vacancyStage.findUnique({ where: { id: vacancyStageId } });
    if (!round) {
      return res.status(404).json({ error: "vacancyStageId not found" });
    }

    const scheduledDate = new Date(scheduledAt);
    const conflict = await validatePanelistsAndConflict(round.vacancyId, panelistUserIds, scheduledDate);
    if (conflict) {
      return res.status(conflict.status).json({ error: conflict.error });
    }
    const managementCheck = await checkFinalRoundHasManagement(round.vacancyId, round.order, panelistUserIds);
    if (managementCheck) {
      return res.status(managementCheck.status).json({ error: managementCheck.error });
    }

    const slot = await prisma.interviewSlot.create({
      data: {
        vacancyStageId,
        scheduledAt: scheduledDate,
        roundLabel: roundLabel?.trim() || null,
        panelists: { create: panelistUserIds.map((userId) => ({ userId })) },
      },
      include: { panelists: { include: { user: true } }, vacancyStage: { include: { vacancy: true } } },
    });

    await writeAuditLog(req.user!.id, "INTERVIEW_SCHEDULED", "Interview", slot.id, {
      vacancyStageId,
      scheduledAt: slot.scheduledAt.toISOString(),
    });

    res.status(201).json(slot);
  } catch (err: any) {
    if (err.code === "P2003") {
      return res.status(404).json({ error: "vacancyStageId or one of the panelists was not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not create interview slot" });
  }
}

// HR Interviews calendar landing page: every slot in an optional date range,
// with enough on each to (a) know which calendar days to colour and (b) show
// the day sidebar's list, auto-labelled "Vacancy - Stage - Round" per the
// wireframe ("Software Engineer- Technical interview -- round 02"). `from`/
// `to` are inclusive whole-day bounds in the caller's local sense -- passed
// straight through as Date boundaries, no timezone conversion attempted
// server-side (matches how scheduledAt is stored/read everywhere else).
export async function listInterviewSlots(req: Request, res: Response) {
  const { from, to } = req.query as { from?: string; to?: string };

  try {
    const where: Record<string, unknown> = {};
    if (from || to) {
      where.scheduledAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const slots = await prisma.interviewSlot.findMany({
      where,
      include: {
        vacancyStage: { include: { vacancy: { select: { id: true, title: true, department: true } } } },
        panelists: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { interviews: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });

    res.json(
      slots.map((s) => ({
        id: s.id,
        scheduledAt: s.scheduledAt,
        roundLabel: s.roundLabel,
        vacancyStage: s.vacancyStage,
        panelists: s.panelists,
        candidateCount: s._count.interviews,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list interview slots" });
  }
}

// Slot detail (the "click an interview" page in the wireframe) -- panel and
// every candidate currently in this slot, plus whether each candidate's
// interview already has feedback in (so the HR view can show progress, not
// just names).
export async function getInterviewSlotDetail(req: Request, res: Response) {
  const slotId = Number(req.params.slotId);
  if (Number.isNaN(slotId)) {
    return res.status(400).json({ error: "Invalid interview id" });
  }

  try {
    const slot = await prisma.interviewSlot.findUnique({
      where: { id: slotId },
      include: {
        vacancyStage: { include: { vacancy: { select: { id: true, title: true, department: true } } } },
        panelists: { include: { user: { select: { id: true, name: true, email: true } } } },
        interviews: {
          include: {
            application: { include: { candidate: true } },
            feedback: { select: { id: true, interviewerId: true } },
          },
        },
      },
    });

    if (!slot) {
      return res.status(404).json({ error: "Interview slot not found" });
    }

    res.json(slot);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch interview slot" });
  }
}

// New primitive: attach one or more candidates (by applicationId) to an
// existing slot. Matches the wireframe's multi-select "add to interview"
// flow. Each candidate gets the same validation scheduleInterview always
// applied (must be SHORTLISTED, round must belong to their vacancy) plus a
// same-vacancy-as-the-slot check, since a slot's round only makes sense for
// one vacancy. Reports success/failure per candidate rather than failing the
// whole batch on one bad entry, same pattern as the CV upload endpoint.
export async function addCandidatesToSlot(req: Request, res: Response) {
  const slotId = Number(req.params.id);
  if (Number.isNaN(slotId)) {
    return res.status(400).json({ error: "Invalid interview id" });
  }

  const { applicationIds } = req.body as { applicationIds?: number[] };
  if (!applicationIds || applicationIds.length === 0) {
    return res.status(400).json({ error: "applicationIds must be a non-empty array" });
  }

  try {
    const slot = await prisma.interviewSlot.findUnique({
      where: { id: slotId },
      include: { vacancyStage: true, panelists: { include: { user: true } } },
    });
    if (!slot) {
      return res.status(404).json({ error: "Interview slot not found" });
    }

    const added: number[] = [];
    const failed: { applicationId: number; error: string }[] = [];

    for (const applicationId of applicationIds) {
      const application = await prisma.candidateApplication.findUnique({
        where: { id: applicationId },
        include: { candidate: true, vacancy: true },
      });
      if (!application) {
        failed.push({ applicationId, error: "Application not found" });
        continue;
      }
      if (application.vacancyId !== slot.vacancyStage.vacancyId) {
        failed.push({ applicationId, error: "Candidate does not belong to this slot's vacancy" });
        continue;
      }
      if (application.stage !== "SHORTLISTED") {
        failed.push({ applicationId, error: "Candidate must be shortlisted before an interview can be scheduled" });
        continue;
      }

      try {
        const interview = await prisma.interview.create({ data: { slotId, applicationId } });
        added.push(interview.id);

        // Same round-1-only auto-invite rule as scheduleInterview() above.
        if (slot.vacancyStage.order === 1) {
          try {
            const when = slot.scheduledAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
            const candidateEmail = await renderTemplate("interview_scheduled_candidate", {
              candidateName: application.candidate.name,
              vacancyTitle: application.vacancy.title,
              stageLabel: slot.vacancyStage.name,
              when,
            });
            await sendEmail({ to: application.candidate.email, subject: candidateEmail.subject, body: candidateEmail.body });
            await writeAuditLog(req.user!.id, "NOTIFICATION_SENT", "Interview", interview.id, {
              recipient: application.candidate.email,
              channel: "email",
              reason: "interview_scheduled_candidate",
            });
          } catch (emailErr) {
            console.error("Candidate added to interview but notification email failed:", emailErr);
          }
        }

        await writeAuditLog(req.user!.id, "INTERVIEW_SCHEDULED", "Interview", interview.id, {
          applicationId,
          slotId,
        });
      } catch (err: any) {
        if (err.code === "P2002") {
          failed.push({ applicationId, error: "This candidate is already in this interview" });
        } else {
          failed.push({ applicationId, error: "Could not add this candidate" });
        }
      }
    }

    res.status(added.length > 0 ? 201 : 400).json({ added, failed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not add candidates to interview" });
  }
}

export async function listInterviewsForApplication(req: Request, res: Response) {
  const applicationId = Number(req.params.id);
  if (Number.isNaN(applicationId)) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  try {
    const interviews = await prisma.interview.findMany({
      where: { applicationId },
      include: { slot: { include: { panelists: { include: { user: true } }, vacancyStage: true } } },
      orderBy: { slot: { scheduledAt: "asc" } },
    });
    res.json(interviews.map(flattenInterview));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list interviews" });
  }
}

export async function getInterview(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid interview id" });
  }

  try {
    const interview = await prisma.interview.findUnique({
      where: { id },
      include: {
        application: { include: { candidate: true, vacancy: true } },
        slot: { include: { panelists: { include: { user: true } }, vacancyStage: true } },
      },
    });

    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    res.json(flattenInterview(interview));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch interview" });
  }
}

export async function listMyInterviews(req: Request, res: Response) {
  const userId = req.user!.id;

  try {
    const interviews = await prisma.interview.findMany({
      where: { slot: { panelists: { some: { userId } } } },
      include: {
        application: { include: { candidate: true, vacancy: true } },
        slot: { include: { panelists: { include: { user: true } }, vacancyStage: true } },
        // Only this panelist's own feedback -- just enough to know whether
        // they still owe feedback on this row, not to see whether anyone
        // else has submitted (that's not this endpoint's concern).
        // createdAt included so the frontend can sort submitted rows by
        // when feedback was actually left, per the corrections-doc ask
        // ("pending to the top, submitted to the bottom, by time of comment").
        feedback: { where: { interviewerId: userId }, select: { id: true, createdAt: true } },
      },
      orderBy: { slot: { scheduledAt: "asc" } },
    });
    res.json(
      interviews.map(({ feedback, ...rest }) => ({
        ...flattenInterview(rest),
        feedbackSubmitted: feedback.length > 0,
        feedbackSubmittedAt: feedback[0]?.createdAt ?? null,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch your interviews" });
  }
}

export async function addPanelist(req: Request, res: Response) {
  const interviewId = Number(req.params.id);
  if (Number.isNaN(interviewId)) {
    return res.status(400).json({ error: "Invalid interview id" });
  }

  const { userId } = req.body as { userId?: number };
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    // Panelists belong to the slot (the shared time/panel/round), not to any
    // one candidate's Interview row -- adding one here adds them for every
    // candidate in this slot.
    const interview = await prisma.interview.findUnique({ where: { id: interviewId }, select: { slotId: true } });
    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    const panelist = await prisma.interviewPanelist.create({
      data: { slotId: interview.slotId, userId },
      include: { user: true },
    });
    res.status(201).json(panelist);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "This user is already a panelist on this interview" });
    }
    if (err.code === "P2003") {
      return res.status(404).json({ error: "Interview or user not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not add panelist" });
  }
}

export async function removePanelist(req: Request, res: Response) {
  const interviewId = Number(req.params.id);
  const userId = Number(req.params.userId);
  if (Number.isNaN(interviewId) || Number.isNaN(userId)) {
    return res.status(400).json({ error: "Invalid interview or user id" });
  }

  try {
    const interview = await prisma.interview.findUnique({ where: { id: interviewId }, select: { slotId: true } });
    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    await prisma.interviewPanelist.delete({
      where: { slotId_userId: { slotId: interview.slotId, userId } },
    });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Panelist not found on this interview" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not remove panelist" });
  }
}
