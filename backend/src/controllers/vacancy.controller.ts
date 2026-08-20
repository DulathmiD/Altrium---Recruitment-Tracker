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
  } catch (err) {
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
      include: { stages: { orderBy: { order: "asc" } } },
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
    console.error(err);
    res.status(500).json({ error: "Could not update vacancy" });
  }
}

export async function addStage(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  const { name, order } = req.body as { name?: string; order?: number };

  if (!name || order === undefined) {
    return res.status(400).json({ error: "name and order are required" });
  }

  try {
    const stage = await prisma.vacancyStage.create({
      data: { vacancyId, name, order },
    });
    res.status(201).json(stage);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "A stage with this order already exists for this vacancy" });
    }
    if (err.code === "P2003") {
      return res.status(404).json({ error: "Vacancy not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not create stage" });
  }
}

export async function updateStage(req: Request, res: Response) {
  const stageId = Number(req.params.stageId);
  if (Number.isNaN(stageId)) {
    return res.status(400).json({ error: "Invalid stage id" });
  }

  const { name, order } = req.body as { name?: string; order?: number };

  try {
    const stage = await prisma.vacancyStage.update({
      where: { id: stageId },
      data: { name, order },
    });
    res.json(stage);
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Stage not found" });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ error: "A stage with this order already exists for this vacancy" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not update stage" });
  }
}

export async function deleteStage(req: Request, res: Response) {
  const stageId = Number(req.params.stageId);
  if (Number.isNaN(stageId)) {
    return res.status(400).json({ error: "Invalid stage id" });
  }

  try {
    await prisma.vacancyStage.delete({ where: { id: stageId } });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Stage not found" });
    }
    if (err.code === "P2003" || err.code === "P2014") {
      return res
        .status(409)
        .json({ error: "Cannot delete a stage that already has interviews scheduled against it" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not delete stage" });
  }
}
