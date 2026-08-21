import type { Request, Response } from "express";
import { prisma } from "../prisma.js";

export async function submitFeedback(req: Request, res: Response) {
  const interviewId = Number(req.params.id);
  if (Number.isNaN(interviewId)) {
    return res.status(400).json({ error: "Invalid interview id" });
  }

  const { score, comments } = req.body as { score?: number; comments?: string };
  if (score === undefined || score === null || !comments) {
    return res.status(400).json({ error: "score and comments are required" });
  }

  const interviewerId = req.user!.id;

  try {
    const isPanelist = await prisma.interviewPanelist.findUnique({
      where: { interviewId_userId: { interviewId, userId: interviewerId } },
    });
    if (!isPanelist) {
      return res.status(403).json({ error: "You are not a panelist on this interview" });
    }

    const feedback = await prisma.feedback.create({
      data: { interviewId, interviewerId, score, comments },
      include: { interviewer: true },
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

export async function listFeedbackForInterview(req: Request, res: Response) {
  const interviewId = Number(req.params.id);
  if (Number.isNaN(interviewId)) {
    return res.status(400).json({ error: "Invalid interview id" });
  }

  try {
    const feedback = await prisma.feedback.findMany({
      where: { interviewId },
      include: { interviewer: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(feedback);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list feedback" });
  }
}

export async function listFeedbackForVacancy(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  try {
    const feedback = await prisma.feedback.findMany({
      where: { interview: { application: { vacancyId } } },
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
