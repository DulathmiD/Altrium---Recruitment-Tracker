import type { Request, Response } from "express";
import { prisma } from "../prisma.js";

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
      include: { candidate: true, vacancy: true },
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
