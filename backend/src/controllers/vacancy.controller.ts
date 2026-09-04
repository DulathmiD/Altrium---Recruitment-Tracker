import type { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { writeAuditLog } from "../utils/auditLog.js";

const VALID_STATUSES = ["OPEN", "CLOSED", "ON_HOLD"] as const;
type VacancyStatusValue = (typeof VALID_STATUSES)[number];

// targetFillDate is optional and nullable -- undefined means "leave
// untouched" (PATCH didn't send it), null means "explicitly clear it", a
// valid date string means "set it". Returns undefined for "don't touch",
// Date|null otherwise, or throws a string error message for an invalid date.
function parseTargetFillDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("targetFillDate must be a valid date");
  }
  return parsed;
}

export async function createVacancy(req: Request, res: Response) {
  const { title, department, description, requirements, preferredSkills, targetFillDate } = req.body as {
    title?: string;
    department?: string;
    description?: string;
    requirements?: string;
    preferredSkills?: string;
    targetFillDate?: string | null;
  };

  if (!title || !department || !description) {
    return res.status(400).json({ error: "title, department, and description are required" });
  }

  let parsedTargetFillDate: Date | null | undefined;
  try {
    parsedTargetFillDate = parseTargetFillDate(targetFillDate);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const vacancy = await prisma.vacancy.create({
      data: {
        title,
        department,
        description,
        ...(requirements !== undefined ? { requirements } : {}),
        ...(preferredSkills !== undefined ? { preferredSkills } : {}),
        ...(parsedTargetFillDate !== undefined ? { targetFillDate: parsedTargetFillDate } : {}),
      },
    });
    await writeAuditLog(req.user!.id, "VACANCY_CREATED", "Vacancy", vacancy.id, {
      title: vacancy.title,
      department: vacancy.department,
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
      ...(status ? { where: { status: status as VacancyStatusValue } } : {}),
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

  const { title, department, description, requirements, preferredSkills, status, targetFillDate } = req.body as {
    title?: string;
    department?: string;
    description?: string;
    requirements?: string;
    preferredSkills?: string;
    status?: VacancyStatusValue;
    targetFillDate?: string | null;
  };

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  let parsedTargetFillDate: Date | null | undefined;
  try {
    parsedTargetFillDate = parseTargetFillDate(targetFillDate);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }

  try {
    // Fetched before the update so we can tell "edited" apart from "closed" --
    // both go through this same function, only the status transition differs.
    const before = await prisma.vacancy.findUnique({ where: { id }, select: { status: true } });
    if (!before) {
      return res.status(404).json({ error: "Vacancy not found" });
    }

    const vacancy = await prisma.vacancy.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(department !== undefined ? { department } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(requirements !== undefined ? { requirements } : {}),
        ...(preferredSkills !== undefined ? { preferredSkills } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(parsedTargetFillDate !== undefined ? { targetFillDate: parsedTargetFillDate } : {}),
      },
    });

    if (status && status === "CLOSED" && before.status !== "CLOSED") {
      await writeAuditLog(req.user!.id, "VACANCY_CLOSED", "Vacancy", vacancy.id, {
        title: vacancy.title,
      });
    } else {
      await writeAuditLog(req.user!.id, "VACANCY_EDITED", "Vacancy", vacancy.id, {
        title: vacancy.title,
        fieldsChanged: Object.keys(req.body as object),
      });
    }

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

// US-05: HR-configurable interview rounds. The round list is locked once any
// candidate application on this vacancy has entered a round -- there's no
// stored lock flag, it's derived by checking whether any
// CandidateApplication.currentVacancyStageId is set for this vacancy (see the
// field comment in schema.prisma for why that value persists after
// HIRED/REJECTED instead of being nulled out).
async function isRoundsLocked(vacancyId: number): Promise<boolean> {
  const count = await prisma.candidateApplication.count({
    where: { vacancyId, currentVacancyStageId: { not: null } },
  });
  return count > 0;
}

export async function listVacancyStages(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  try {
    const [stages, locked] = await Promise.all([
      prisma.vacancyStage.findMany({ where: { vacancyId }, orderBy: { order: "asc" } }),
      isRoundsLocked(vacancyId),
    ]);
    res.json({ stages, locked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list interview rounds" });
  }
}

export async function createVacancyStage(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    const vacancy = await prisma.vacancy.findUnique({ where: { id: vacancyId } });
    if (!vacancy) {
      return res.status(404).json({ error: "Vacancy not found" });
    }
    if (await isRoundsLocked(vacancyId)) {
      return res.status(400).json({
        error: "This vacancy's interview rounds are locked - a candidate has already entered a round",
      });
    }

    const lastRound = await prisma.vacancyStage.findFirst({ where: { vacancyId }, orderBy: { order: "desc" } });
    const stage = await prisma.vacancyStage.create({
      data: { vacancyId, name: name.trim(), order: (lastRound?.order ?? 0) + 1 },
    });
    res.status(201).json(stage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create interview round" });
  }
}

export async function updateVacancyStage(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  const stageId = Number(req.params.stageId);
  if (Number.isNaN(vacancyId) || Number.isNaN(stageId)) {
    return res.status(400).json({ error: "Invalid vacancy or round id" });
  }

  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    const existing = await prisma.vacancyStage.findUnique({ where: { id: stageId } });
    if (!existing || existing.vacancyId !== vacancyId) {
      return res.status(404).json({ error: "Interview round not found on this vacancy" });
    }
    if (await isRoundsLocked(vacancyId)) {
      return res.status(400).json({
        error: "This vacancy's interview rounds are locked - a candidate has already entered a round",
      });
    }

    const stage = await prisma.vacancyStage.update({ where: { id: stageId }, data: { name: name.trim() } });
    res.json(stage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not rename interview round" });
  }
}

export async function deleteVacancyStage(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  const stageId = Number(req.params.stageId);
  if (Number.isNaN(vacancyId) || Number.isNaN(stageId)) {
    return res.status(400).json({ error: "Invalid vacancy or round id" });
  }

  try {
    const existing = await prisma.vacancyStage.findUnique({ where: { id: stageId } });
    if (!existing || existing.vacancyId !== vacancyId) {
      return res.status(404).json({ error: "Interview round not found on this vacancy" });
    }
    if (await isRoundsLocked(vacancyId)) {
      return res.status(400).json({
        error: "This vacancy's interview rounds are locked - a candidate has already entered a round",
      });
    }

    // Safe to renumber the remaining rounds here -- deletion is only ever
    // reachable while unlocked, i.e. before any candidate has entered any
    // round on this vacancy, so no history references the order being shifted.
    await prisma.$transaction(async (tx) => {
      await tx.vacancyStage.delete({ where: { id: stageId } });
      const remaining = await tx.vacancyStage.findMany({ where: { vacancyId }, orderBy: { order: "asc" } });
      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        if (item && item.order !== i + 1) {
          await tx.vacancyStage.update({ where: { id: item.id }, data: { order: i + 1 } });
        }
      }
    });

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete interview round" });
  }
}

export async function reorderVacancyStages(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  const { order } = req.body as { order?: number[] };
  if (!order || !Array.isArray(order) || order.length === 0) {
    return res.status(400).json({ error: "order (array of interview round ids in the desired sequence) is required" });
  }

  try {
    if (await isRoundsLocked(vacancyId)) {
      return res.status(400).json({
        error: "This vacancy's interview rounds are locked - a candidate has already entered a round",
      });
    }

    const existing = await prisma.vacancyStage.findMany({ where: { vacancyId } });
    const existingIds = new Set(existing.map((s) => s.id));
    if (order.length !== existing.length || !order.every((id) => existingIds.has(id))) {
      return res.status(400).json({ error: "order must contain exactly this vacancy's current round ids, each once" });
    }

    // Two-phase update: an arbitrary permutation can require moving some rows
    // to a HIGHER order, which can collide with the @@unique([vacancyId,
    // order]) constraint on a row that hasn't been updated yet within the
    // same transaction (MySQL checks uniqueness per-statement, not deferred).
    // Parking every row at a distinct negative order first guarantees no
    // collision in either phase.
    await prisma.$transaction([
      ...order.map((id, i) => prisma.vacancyStage.update({ where: { id }, data: { order: -(i + 1) } })),
      ...order.map((id, i) => prisma.vacancyStage.update({ where: { id }, data: { order: i + 1 } })),
    ]);

    const stages = await prisma.vacancyStage.findMany({ where: { vacancyId }, orderBy: { order: "asc" } });
    res.json(stages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not reorder interview rounds" });
  }
}
