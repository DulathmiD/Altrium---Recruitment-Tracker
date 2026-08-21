import type { Request, Response } from "express";
import { prisma } from "../prisma.js";

const VALID_STATUSES = ["OPEN", "CLOSED", "ON_HOLD"] as const;
type VacancyStatusValue = (typeof VALID_STATUSES)[number];

export async function createVacancy(req: Request, res: Response) {
  const { title, department, description, requirements, preferredSkills } = req.body as {
    title?: string;
    department?: string;
    description?: string;
    requirements?: string;
    preferredSkills?: string;
  };

  if (!title || !department || !description) {
    return res.status(400).json({ error: "title, department, and description are required" });
  }

  try {
    const vacancy = await prisma.vacancy.create({
      data: { title, department, description, requirements, preferredSkills },
    });
    res.status(201).json(vacancy);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "A vacancy with this title and department already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not create vacancy" });
  }
}

export async function listVacancies(req: Request, res: Response) {
  const { status } = req.query as { status?: string };

  if (status && !VALID_STATUSES.includes(status as VacancyStatusValue)) {
    return res.status(400).json({ error: "Invalid status filter" });
  }

  try {
    const vacancies = await prisma.vacancy.findMany({
      where: status ? { status: status as VacancyStatusValue } : undefined,
      orderBy: { createdAt: "desc" },
    });
    res.json(vacancies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list vacancies" });
  }
}

export async function getVacancy(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  try {
    const vacancy = await prisma.vacancy.findUnique({
      where: { id },
      include: { interviewers: { include: { user: true } } },
    });

    if (!vacancy) {
      return res.status(404).json({ error: "Vacancy not found" });
    }

    res.json(vacancy);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch vacancy" });
  }
}

export async function updateVacancy(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  const { title, department, description, requirements, preferredSkills, status } = req.body as {
    title?: string;
    department?: string;
    description?: string;
    requirements?: string;
    preferredSkills?: string;
    status?: VacancyStatusValue;
  };

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  try {
    const vacancy = await prisma.vacancy.update({
      where: { id },
      data: { title, department, description, requirements, preferredSkills, status },
    });
    res.json(vacancy);
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Vacancy not found" });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ error: "A vacancy with this title and department already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not update vacancy" });
  }
}

// US-10/US-11: HR assigns interviewers/management personnel to a vacancy as a
// standing pool ahead of scheduling any specific interview session.
export async function assignInterviewerToVacancy(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  const { userId } = req.body as { userId?: number };
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser || !["INTERVIEWER", "MANAGEMENT", "HIRING_MANAGER"].includes(targetUser.role)) {
      return res.status(400).json({
        error: "userId must belong to an Interviewer, Management, or Hiring Manager user",
      });
    }

    const assignment = await prisma.vacancyInterviewer.create({
      data: { vacancyId, userId },
      include: { user: true },
    });
    res.status(201).json(assignment);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "This user is already assigned to this vacancy" });
    }
    if (err.code === "P2003") {
      return res.status(404).json({ error: "Vacancy not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not assign interviewer to vacancy" });
  }
}

export async function removeInterviewerFromVacancy(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  const userId = Number(req.params.userId);
  if (Number.isNaN(vacancyId) || Number.isNaN(userId)) {
    return res.status(400).json({ error: "Invalid vacancy or user id" });
  }

  try {
    await prisma.vacancyInterviewer.delete({
      where: { vacancyId_userId: { vacancyId, userId } },
    });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "This user is not assigned to this vacancy" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not remove interviewer from vacancy" });
  }
}

export async function listVacancyInterviewers(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  try {
    const interviewers = await prisma.vacancyInterviewer.findMany({
      where: { vacancyId },
      include: { user: true },
    });
    res.json(interviewers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list vacancy interviewers" });
  }
}
