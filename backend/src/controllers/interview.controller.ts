import type { Request, Response } from "express";
import { prisma } from "../prisma.js";

export async function scheduleInterview(req: Request, res: Response) {
  const applicationId = Number(req.params.id);
  if (Number.isNaN(applicationId)) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  const { stageId, scheduledAt, panelistUserIds } = req.body as {
    stageId?: number;
    scheduledAt?: string;
    panelistUserIds?: number[];
  };

  if (!stageId || !scheduledAt || !panelistUserIds || panelistUserIds.length === 0) {
    return res
      .status(400)
      .json({ error: "stageId, scheduledAt, and at least one panelistUserIds entry are required" });
  }

  try {
    const interview = await prisma.interview.create({
      data: {
        applicationId,
        stageId,
        scheduledAt: new Date(scheduledAt),
        panelists: {
          create: panelistUserIds.map((userId) => ({ userId })),
        },
      },
      include: { panelists: { include: { user: true } } },
    });
    res.status(201).json(interview);
  } catch (err: any) {
    if (err.code === "P2003") {
      return res.status(404).json({ error: "Application, stage, or one of the panelists was not found" });
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
      include: { stage: true, panelists: { include: { user: true } } },
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
        stage: true,
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
        stage: true,
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
