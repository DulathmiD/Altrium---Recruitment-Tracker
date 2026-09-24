import type { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { writeAuditLog } from "../utils/auditLog.js";
import { notifyUser } from "../utils/notify.js";

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

// R-10 in the risk register: title+department uniqueness used to be a hard
// DB constraint covering every vacancy regardless of status, so a CLOSED
// vacancy permanently blocked ever reposting the same role -- a legitimate,
// expected business action. Only OPEN/ON_HOLD ("active") vacancies count as
// a conflict now; a CLOSED one with the same title+department is fine.
// excludeId lets updateVacancy check without the vacancy matching itself.
async function hasActiveDuplicate(title: string, department: string, excludeId?: number): Promise<boolean> {
  const existing = await prisma.vacancy.findFirst({
    where: {
      title,
      department,
      status: { in: ["OPEN", "ON_HOLD"] },
      ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return existing !== null;
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
    // A brand new vacancy always starts OPEN (the schema default), which is
    // active by definition, so this checks unconditionally -- no need to
    // consider a target status here the way updateVacancy does.
    if (await hasActiveDuplicate(title, department)) {
      return res.status(409).json({ error: "An active vacancy with this title and department already exists" });
    }

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
    // Also used below to compute the *effective* post-update title/
    // department/status for the active-duplicate check, since a PATCH-style
    // request may only send some of these fields.
    const before = await prisma.vacancy.findUnique({ where: { id }, select: { status: true, title: true, department: true } });
    if (!before) {
      return res.status(404).json({ error: "Vacancy not found" });
    }

    const effectiveTitle = title !== undefined ? title : before.title;
    const effectiveDepartment = department !== undefined ? department : before.department;
    const effectiveStatus = status !== undefined ? status : before.status;
    const isBecomingOrStayingActive = effectiveStatus === "OPEN" || effectiveStatus === "ON_HOLD";

    if (isBecomingOrStayingActive && (await hasActiveDuplicate(effectiveTitle, effectiveDepartment, id))) {
      return res.status(409).json({ error: "An active vacancy with this title and department already exists" });
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
    // Hiring Managers don't sit on interview panels -- see the same note in
    // interviewPanel.controller.ts. Kept in sync so this older endpoint
    // (superseded by POST /vacancies/:id/panels for panel-building, but
    // still the thing that owns the underlying pool) can't be used to add
    // one via a stale client either.
    if (!targetUser || !["INTERVIEWER", "MANAGEMENT"].includes(targetUser.role)) {
      return res.status(400).json({
        error: "userId must belong to an Interviewer or Management user",
      });
    }

    const assignment = await prisma.vacancyInterviewer.create({
      data: { vacancyId, userId },
      include: { user: true, vacancy: true },
    });

    // Notify the person they've been put on this vacancy's standing pool --
    // previously only interview *scheduling* fired a notification, so being
    // added to a vacancy's interviewer pool was silent. Best-effort, same as
    // every other notifyUser() call site: never blocks the assignment itself.
    await notifyUser(
      userId,
      "vacancy_interviewer_assigned",
      `You've been added to the interviewer pool for ${assignment.vacancy.title}.`
    );

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

// US-05: HR-configurable interview rounds.
//
// Per-round lock (corrected from an earlier whole-vacancy lock): a specific
// round is locked once any candidate has ever entered it -- checked against
// ApplicationStageHistory, not CandidateApplication.currentVacancyStageId.
// currentVacancyStageId only reflects where a candidate sits *right now*, so
// once someone advances past round 1 into round 2, round 1 would wrongly
// read as "untouched" if checked that way -- ApplicationStageHistory keeps a
// permanent row per round ever entered (see transitionApplicationStage in
// utils/stageTransition.ts), so it's the correct signal for "has this round
// EVER been used," not just "is anyone sitting in it this second."
//
// Because ADVANCE always moves a candidate to the next round in live `order`
// sequence (see submitStageRecommendation), and a candidate can only ever
// reach round N by having passed through rounds 1..N-1 first, the set of
// locked rounds across a vacancy is always a contiguous prefix of the
// current round list -- "round 1 and 2 are locked, 3 onward are still
// untouched," never a locked round sitting after an unlocked one. Creating a
// brand new round only ever appends after the current last round, so it
// never touches an existing round's data and doesn't need a lock check at
// all -- see createVacancyStage below.
async function isStageLocked(vacancyStageId: number): Promise<boolean> {
  const count = await prisma.applicationStageHistory.count({
    where: { vacancyStageId },
  });
  return count > 0;
}

// Batch version for listVacancyStages / reorderVacancyStages, which both
// need every round's lock status at once rather than one at a time.
async function lockedStageIdSet(vacancyId: number): Promise<Set<number>> {
  const stageIds = (await prisma.vacancyStage.findMany({ where: { vacancyId }, select: { id: true } })).map(
    (s) => s.id
  );
  if (stageIds.length === 0) return new Set();
  const rows = await prisma.applicationStageHistory.findMany({
    where: { vacancyStageId: { in: stageIds } },
    select: { vacancyStageId: true },
    distinct: ["vacancyStageId"],
  });
  return new Set(rows.map((r) => r.vacancyStageId).filter((id): id is number => id !== null));
}

export async function listVacancyStages(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  try {
    const [stages, locked] = await Promise.all([
      prisma.vacancyStage.findMany({ where: { vacancyId }, orderBy: { order: "asc" } }),
      lockedStageIdSet(vacancyId),
    ]);
    // `locked` is now per-round (was a single vacancy-wide boolean) -- each
    // stage carries its own lock flag so untouched later rounds stay
    // editable even while earlier rounds are locked.
    res.json({ stages: stages.map((s) => ({ ...s, locked: locked.has(s.id) })) });
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
    // No lock check -- a new round always appends after the current last
    // round (below), so it never touches an existing round's data or order,
    // locked or not. See the comment above isStageLocked().

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
    if (await isStageLocked(stageId)) {
      return res.status(400).json({
        error: "This round is locked - a candidate has already entered it",
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
    if (await isStageLocked(stageId)) {
      return res.status(400).json({
        error: "This round is locked - a candidate has already entered it",
      });
    }

    // Safe to renumber the remaining rounds here even though earlier rounds
    // on this vacancy may be locked: only rounds at or after the deleted
    // round's position shift order, and per the prefix invariant above, a
    // round only reaches "unlocked" (reachable here) if every round after it
    // is also still unlocked -- so nothing that shifts was ever locked.
    // Rounds before the deleted one keep their existing order untouched.
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
    const existing = await prisma.vacancyStage.findMany({ where: { vacancyId }, orderBy: { order: "asc" } });
    const existingIds = new Set(existing.map((s) => s.id));
    if (order.length !== existing.length || !order.every((id) => existingIds.has(id))) {
      return res.status(400).json({ error: "order must contain exactly this vacancy's current round ids, each once" });
    }

    // Locked rounds (already entered by a candidate) must keep both their
    // relative order AND their position as a prefix of the list -- moving an
    // unlocked round to before a locked one would make it look, after the
    // fact, like every candidate who already passed through that locked
    // round had skipped the newly-inserted one. Only the untouched rounds
    // after the locked prefix can be freely reordered among themselves.
    const locked = await lockedStageIdSet(vacancyId);
    const lockedPrefix = existing.filter((s) => locked.has(s.id)).map((s) => s.id);
    const requestedPrefix = order.slice(0, lockedPrefix.length);
    const prefixUnchanged = lockedPrefix.every((id, i) => requestedPrefix[i] === id);
    if (!prefixUnchanged) {
      return res.status(400).json({
        error: "Locked rounds (already entered by a candidate) must stay in their current order and position",
      });
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
