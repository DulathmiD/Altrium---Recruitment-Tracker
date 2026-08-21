import type { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { sendEmail } from "../utils/mailer.js";
import { STAGE_LABELS } from "../utils/stageTransition.js";

const INTERVIEW_STAGES = ["INTERVIEW_1", "INTERVIEW_2", "FINAL_INTERVIEW"] as const;

export async function scheduleInterview(req: Request, res: Response) {
  const applicationId = Number(req.params.id);
  if (Number.isNaN(applicationId)) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  const { stage, scheduledAt, panelistUserIds } = req.body as {
    stage?: string;
    scheduledAt?: string;
    panelistUserIds?: number[];
  };

  if (!stage || !scheduledAt || !panelistUserIds || panelistUserIds.length === 0) {
    return res
      .status(400)
      .json({ error: "stage, scheduledAt, and at least one panelistUserIds entry are required" });
  }
  if (!INTERVIEW_STAGES.includes(stage as (typeof INTERVIEW_STAGES)[number])) {
    return res.status(400).json({ error: `stage must be one of: ${INTERVIEW_STAGES.join(", ")}` });
  }

  try {
    const application = await prisma.candidateApplication.findUnique({ where: { id: applicationId } });
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // US-10: panelists must already be assigned to this vacancy's interviewer pool.
    const assignedInterviewers = await prisma.vacancyInterviewer.findMany({
      where: { vacancyId: application.vacancyId, userId: { in: panelistUserIds } },
    });
    if (assignedInterviewers.length !== panelistUserIds.length) {
      return res.status(400).json({
        error: "One or more panelists are not assigned to this vacancy. Assign them via POST /vacancies/:id/interviewers first.",
      });
    }

    // US-11: reject if any panelist already has another interview at this exact time.
    const scheduledDate = new Date(scheduledAt);
    const conflicting = await prisma.interview.findFirst({
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
      return res.status(409).json({
        error: `Scheduling conflict: ${conflictingNames} already has another interview at this exact time`,
      });
    }

    const interview = await prisma.interview.create({
      data: {
        applicationId,
        stage: stage as any,
        scheduledAt: scheduledDate,
        panelists: {
          create: panelistUserIds.map((userId) => ({ userId })),
        },
      },
      include: {
        panelists: { include: { user: true } },
        application: { include: { candidate: true, vacancy: true } },
      },
    });

    // Email failures must never block the scheduling action itself -- log and move on.
    try {
      const { candidate, vacancy } = interview.application;
      const stageLabel = STAGE_LABELS[interview.stage];
      const when = interview.scheduledAt.toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      });

      for (const panelist of interview.panelists) {
        await sendEmail({
          to: panelist.user.email,
          subject: `Interview scheduled: ${candidate.name} for ${vacancy.title}`,
          body: `Hi ${panelist.user.name},\n\nYou've been assigned to interview ${candidate.name} for the ${vacancy.title} role (${stageLabel} stage).\n\nScheduled for: ${when}\n\nCandidate CV: ${candidate.cvUrl}`,
        });
      }

      await sendEmail({
        to: candidate.email,
        subject: `Your interview for ${vacancy.title} at Altrium`,
        body: `Hi ${candidate.name},\n\nYour ${stageLabel} interview for the ${vacancy.title} role has been scheduled.\n\nDate/time: ${when}\n\nWe'll be in touch with further details. If you have any questions, reply to this email.`,
      });
    } catch (emailErr) {
      console.error("Interview scheduled but notification email(s) failed:", emailErr);
    }

    res.status(201).json(interview);
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

export async function listInterviewsForApplication(req: Request, res: Response) {
  const applicationId = Number(req.params.id);
  if (Number.isNaN(applicationId)) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  try {
    const interviews = await prisma.interview.findMany({
      where: { applicationId },
      include: { panelists: { include: { user: true } } },
      orderBy: { scheduledAt: "asc" },
    });
    res.json(interviews);
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
        panelists: { include: { user: true } },
      },
    });

    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    res.json(interview);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch interview" });
  }
}

export async function listMyInterviews(req: Request, res: Response) {
  const userId = req.user!.id;

  try {
    const interviews = await prisma.interview.findMany({
      where: { panelists: { some: { userId } } },
      include: {
        application: { include: { candidate: true, vacancy: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });
    res.json(interviews);
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
    const panelist = await prisma.interviewPanelist.create({
      data: { interviewId, userId },
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
    await prisma.interviewPanelist.delete({
      where: { interviewId_userId: { interviewId, userId } },
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
