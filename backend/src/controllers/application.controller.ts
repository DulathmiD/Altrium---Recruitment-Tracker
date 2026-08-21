import type { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { sendEmail } from "../utils/mailer.js";

const VALID_STATUSES = ["APPLIED", "SHORTLISTED", "REJECTED", "IN_PROGRESS", "HIRED"] as const;
type ApplicationStatusValue = (typeof VALID_STATUSES)[number];

export async function applyCandidateToVacancy(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  const { candidateId } = req.body as { candidateId?: number };
  if (!candidateId) {
    return res.status(400).json({ error: "candidateId is required" });
  }

  try {
    const application = await prisma.candidateApplication.create({
      data: { candidateId, vacancyId },
    });
    res.status(201).json(application);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "This candidate has already applied to this vacancy" });
    }
    if (err.code === "P2003") {
      return res.status(404).json({ error: "Candidate or vacancy not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not create application" });
  }
}

export async function listApplicationsForVacancy(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  try {
    const applications = await prisma.candidateApplication.findMany({
      where: { vacancyId },
      include: { candidate: true },
      orderBy: { appliedAt: "desc" },
    });
    res.json(applications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list applications" });
  }
}

export async function getApplication(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  try {
    const application = await prisma.candidateApplication.findUnique({
      where: { id },
      include: { candidate: true, vacancy: true, currentStage: true, decidedBy: true, hiringManager: true },
    });

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    res.json(application);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch application" });
  }
}

const VALID_DECISIONS = ["HIRE", "REJECT"] as const;
type HiringDecisionValue = (typeof VALID_DECISIONS)[number];

export async function recordHiringDecision(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  const { hiringDecision } = req.body as { hiringDecision?: HiringDecisionValue };
  if (!hiringDecision || !VALID_DECISIONS.includes(hiringDecision)) {
    return res.status(400).json({ error: "hiringDecision must be HIRE or REJECT" });
  }

  try {
    const application = await prisma.candidateApplication.update({
      where: { id },
      data: {
        hiringDecision,
        decidedByUserId: req.user!.id,
        decidedAt: new Date(),
        status: hiringDecision === "HIRE" ? "HIRED" : "REJECTED",
      },
      include: { candidate: true, vacancy: true, decidedBy: true },
    });

    // Email failure must not block the decision itself -- log and move on.
    try {
      const { candidate, vacancy } = application;
      if (hiringDecision === "HIRE") {
        await sendEmail({
          to: candidate.email,
          subject: `Congratulations - offer for ${vacancy.title} at Altrium`,
          body: `Hi ${candidate.name},\n\nWe're pleased to let you know you've been selected for the ${vacancy.title} role at Altrium. Our HR team will be in touch shortly with next steps and offer details.\n\nCongratulations!`,
        });
      } else {
        await sendEmail({
          to: candidate.email,
          subject: `Update on your application for ${vacancy.title} at Altrium`,
          body: `Hi ${candidate.name},\n\nThank you for taking the time to interview for the ${vacancy.title} role at Altrium. After careful consideration, we've decided to move forward with another candidate.\n\nWe appreciate your interest in Altrium and encourage you to apply for future openings that match your experience.`,
        });
      }
    } catch (emailErr) {
      console.error("Hiring decision recorded but notification email failed:", emailErr);
    }

    res.json(application);
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Application not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not record hiring decision" });
  }
}

export async function compareApplicationsForVacancy(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  try {
    const applications = await prisma.candidateApplication.findMany({
      where: {
        vacancyId,
        status: { in: ["SHORTLISTED", "IN_PROGRESS"] },
      },
      include: {
        candidate: true,
        decidedBy: true,
        interviews: {
          include: {
            stage: true,
            feedback: { include: { interviewer: true } },
          },
        },
      },
      orderBy: { appliedAt: "asc" },
    });
    res.json(applications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build comparison" });
  }
}

export async function updateApplicationStage(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  const { stageId } = req.body as { stageId?: number };
  if (!stageId) {
    return res.status(400).json({ error: "stageId is required" });
  }

  try {
    const application = await prisma.candidateApplication.findUnique({ where: { id } });
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    const stage = await prisma.vacancyStage.findUnique({ where: { id: stageId } });
    if (!stage || stage.vacancyId !== application.vacancyId) {
      return res.status(400).json({ error: "That stage does not belong to this application's vacancy" });
    }

    const updated = await prisma.candidateApplication.update({
      where: { id },
      data: { currentStageId: stageId },
      include: { candidate: true, currentStage: true },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update application stage" });
  }
}

export async function assignHiringManager(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  const { hiringManagerId } = req.body as { hiringManagerId?: number };
  if (!hiringManagerId) {
    return res.status(400).json({ error: "hiringManagerId is required" });
  }

  try {
    const application = await prisma.candidateApplication.findUnique({ where: { id } });
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: hiringManagerId } });
    if (!targetUser || targetUser.role !== "HIRING_MANAGER") {
      return res.status(400).json({ error: "hiringManagerId must belong to a user with the HIRING_MANAGER role" });
    }

    const updated = await prisma.candidateApplication.update({
      where: { id },
      data: { hiringManagerId },
      include: { candidate: true, vacancy: true, hiringManager: true },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not assign hiring manager" });
  }
}

export async function listApplicationsAssignedToMe(req: Request, res: Response) {
  const hiringManagerId = req.user!.id;

  try {
    const applications = await prisma.candidateApplication.findMany({
      where: { hiringManagerId },
      include: { candidate: true, vacancy: true },
      orderBy: { appliedAt: "desc" },
    });
    res.json(applications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list assigned applications" });
  }
}

export async function updateApplicationStatus(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  const { status } = req.body as { status?: ApplicationStatusValue };

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "A valid status is required" });
  }

  try {
    const application = await prisma.candidateApplication.update({
      where: { id },
      data: { status },
    });
    res.json(application);
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Application not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not update application status" });
  }
}
