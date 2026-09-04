import type { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { writeAuditLog } from "../utils/auditLog.js";
import { Role } from "../../generated/prisma/index.js";

// Flagged in wireframe review round 1 ("Feedback score labeled '1-10' with
// no server-side range enforcement") and left tracked-but-unbuilt across
// several sessions since -- every screen that reads a score (Candidate
// Comparison's SCORE_BUCKETS, Pending Decisions' "/10" display) assumes this
// range without the write side ever having enforced it. Integer only --
// half-points aren't part of any AC text or wireframe.
export function isValidScore(score: unknown): score is number {
  return typeof score === "number" && Number.isInteger(score) && score >= 1 && score <= 10;
}

export async function submitFeedback(req: Request, res: Response) {
  const interviewId = Number(req.params.id);
  if (Number.isNaN(interviewId)) {
    return res.status(400).json({ error: "Invalid interview id" });
  }

  const { score, comments } = req.body as { score?: number; comments?: string };
  if (score === undefined || score === null || !comments) {
    return res.status(400).json({ error: "score and comments are required" });
  }
  if (!isValidScore(score)) {
    return res.status(400).json({ error: "score must be a whole number from 1 to 10" });
  }

  const interviewerId = req.user!.id;

  try {
    // Schema split Interview into InterviewSlot (time/panel/round) +
    // Interview (one candidate's participation) -- scheduledAt and panelists
    // now live on the slot. See schema.prisma for the full reasoning.
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      select: {
        slotId: true,
        slot: { select: { scheduledAt: true } },
        application: { select: { candidate: { select: { name: true } } } },
      },
    });
    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }
    // Feedback records what happened -- can't have a valid opinion on an
    // interview that hasn't taken place yet. Not asked separately (low-risk,
    // one clear reading), flagged in the decision log instead.
    if (interview.slot.scheduledAt > new Date()) {
      return res.status(400).json({ error: "This interview hasn't taken place yet - feedback can only be submitted afterward" });
    }

    const isPanelist = await prisma.interviewPanelist.findUnique({
      where: { slotId_userId: { slotId: interview.slotId, userId: interviewerId } },
    });
    if (!isPanelist) {
      return res.status(403).json({ error: "You are not a panelist on this interview" });
    }

    const feedback = await prisma.feedback.create({
      data: { interviewId, interviewerId, score, comments },
      include: { interviewer: true },
    });
    await writeAuditLog(interviewerId, "FEEDBACK_SUBMITTED", "Feedback", feedback.id, {
      interviewId,
      score,
      candidateName: interview.application.candidate.name,
    });
    res.status(201).json(feedback);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "You have already submitted feedback for this interview" });
    }
    if (err.code === "P2003") {
      return res.status(404).json({ error: "Interview not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not submit feedback" });
  }
}

export async function updateFeedback(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid feedback id" });
  }

  const { score, comments, reason } = req.body as {
    score?: number;
    comments?: string;
    reason?: string;
  };
  if (score === undefined && comments === undefined) {
    return res.status(400).json({ error: "Provide score and/or comments to update" });
  }
  if (score !== undefined && !isValidScore(score)) {
    return res.status(400).json({ error: "score must be a whole number from 1 to 10" });
  }
  if (!reason) {
    return res.status(400).json({ error: "A reason for the change is required" });
  }

  try {
    const existing = await prisma.feedback.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Feedback not found" });
    }
    if (existing.interviewerId !== req.user!.id) {
      return res.status(403).json({ error: "You can only edit your own feedback" });
    }

    const newScore = score !== undefined ? score : existing.score;
    const newComments = comments !== undefined ? comments : existing.comments;

    const [updated] = await prisma.$transaction([
      prisma.feedback.update({
        where: { id },
        data: { score: newScore, comments: newComments },
        include: { interviewer: true },
      }),
      prisma.feedbackAuditLog.create({
        data: {
          feedbackId: id,
          editedByUserId: req.user!.id,
          previousScore: existing.score,
          previousComments: existing.comments,
          newScore,
          newComments,
          reason,
        },
      }),
    ]);

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update feedback" });
  }
}

export async function listFeedbackAuditLog(req: Request, res: Response) {
  const feedbackId = Number(req.params.id);
  if (Number.isNaN(feedbackId)) {
    return res.status(400).json({ error: "Invalid feedback id" });
  }

  try {
    const log = await prisma.feedbackAuditLog.findMany({
      where: { feedbackId },
      include: { editedBy: true },
      orderBy: { editedAt: "asc" },
    });
    res.json(log);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch audit log" });
  }
}

// Comment kept accurate as this route's actual (and only) frontend caller
// changed shape: it's used solely by FeedbackPage.tsx's "am I already on
// record for this interview" check (getMyFeedbackForInterview), for every
// role that can be an interview panelist (Interviewer, Management, Hiring
// Manager) -- never a "see the whole panel's feedback" oversight view, so
// every one of those three roles is self-scoped here. (US-25's actual
// "shared feedback visibility" story is served by a different endpoint,
// listFeedbackForVacancy below -- that one intentionally does show HR/HM/
// Management/Leadership everyone's feedback, scoped only for a plain
// Interviewer.) No role gate existed on this specific route at all
// originally; scoped here rather than at the router.
export async function listFeedbackForInterview(req: Request, res: Response) {
  const interviewId = Number(req.params.id);
  if (Number.isNaN(interviewId)) {
    return res.status(400).json({ error: "Invalid interview id" });
  }

  // Corrections doc: Management now also submits feedback (final round
  // attendance), via FeedbackPage.tsx's shared "am I already on record for
  // this interview" check (fb[0] ?? null) -- same self-scoping INTERVIEWER
  // gets, otherwise Management would see the whole panel's feedback list
  // here and misread someone else's entry as their own draft. Extended
  // again to Hiring Manager for the same reason -- HM is an assignable
  // panelist role too (see ASSIGNABLE_ROLES in staff.controller.ts) and now
  // has its own My Candidates -> Feedback flow.
  const scopeToSelf =
    req.user!.role === Role.INTERVIEWER ||
    req.user!.role === Role.MANAGEMENT ||
    req.user!.role === Role.HIRING_MANAGER;

  try {
    const feedback = await prisma.feedback.findMany({
      where: { interviewId, ...(scopeToSelf ? { interviewerId: req.user!.id } : {}) },
      include: { interviewer: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(feedback);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list feedback" });
  }
}

// Same US-25 scoping as listFeedbackForInterview above.
export async function listFeedbackForVacancy(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  const isInterviewer = req.user!.role === Role.INTERVIEWER;

  try {
    const feedback = await prisma.feedback.findMany({
      where: {
        interview: { application: { vacancyId } },
        ...(isInterviewer ? { interviewerId: req.user!.id } : {}),
      },
      include: {
        interviewer: true,
        interview: { include: { application: { include: { candidate: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(feedback);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list feedback for vacancy" });
  }
}
