import type { Request, Response } from "express";
import { prisma } from "../prisma.js";

const VALID_STAGES = ["APPLIED", "SHORTLISTED", "HIRED", "REJECTED"] as const;

// Every candidate-application this interviewer has sat on a panel for, on
// any interview, for any round. Originally the single "My Candidates" data
// source (flat, all-time, per an earlier wireframe review answer) -- since
// superseded by the vacancy+stage drill-down below, so the frontend now
// always calls this WITH `vacancyStageId` (scoped to one group). Left the
// unscoped mode working and exported as a general-purpose "all of this
// interviewer's candidates, anywhere" query, since nothing currently needs
// it removed and narrowing the endpoint's contract isn't worth the churn.
export async function listMyCandidates(req: Request, res: Response) {
  const userId = req.user!.id;
  const { search, stage, vacancyStageId } = req.query as { search?: string; stage?: string; vacancyStageId?: string };

  if (stage && !VALID_STAGES.includes(stage as (typeof VALID_STAGES)[number])) {
    return res.status(400).json({ error: "Invalid stage filter" });
  }

  // Bug fix: this was querying `interviews.panelists`, a field that doesn't
  // exist on Interview -- panelists live on the InterviewSlot the Interview
  // belongs to (see schema.prisma's InterviewSlot/Interview split). Because
  // `where` was typed `any`, tsc never caught this; at runtime it would have
  // thrown a Prisma validation error for every interviewer. Corrected to
  // traverse through `.slot.panelists`.
  //
  // `vacancyStageId` (new, for the vacancy+stage drill-down -- see
  // listMyVacancyStages below) narrows this further to "candidates I actually
  // interviewed at this specific round", rather than every candidate I've
  // ever touched anywhere. Deliberately NOT filtered by the candidate's
  // *current* stage -- a candidate may have since moved on to round 2, but
  // they still belong in this interviewer's round-1 list.
  const panelistFilter: any = vacancyStageId
    ? { slot: { vacancyStageId: Number(vacancyStageId), panelists: { some: { userId } } } }
    : { slot: { panelists: { some: { userId } } } };

  const where: any = {
    interviews: { some: panelistFilter },
  };
  if (stage) where.stage = stage;
  if (search) {
    where.candidate = { OR: [{ name: { contains: search } }, { email: { contains: search } }] };
  }

  try {
    const applications = await prisma.candidateApplication.findMany({
      where,
      include: {
        candidate: true,
        vacancy: true,
        currentVacancyStage: true,
      },
      orderBy: { appliedAt: "desc" },
    });
    res.json(applications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list your candidates" });
  }
}

// My Candidates landing page (corrections doc): instead of one flat
// all-candidates table, HR... sorry, the INTERVIEWER first sees a list of
// "Vacancy - Interview Stage" groups they've actually been a panelist for,
// and drills into one to see just that group's candidates via
// listMyCandidates(?vacancyStageId=...) above. Grouped by vacancyStageId
// (not just vacancyId) per the locked answer -- the same interviewer can
// appear as a separate row for each round of the same vacancy they're on.
export async function listMyVacancyStages(req: Request, res: Response) {
  const userId = req.user!.id;

  try {
    const panelistRows = await prisma.interviewPanelist.findMany({
      where: { userId },
      include: {
        slot: {
          include: {
            vacancyStage: { include: { vacancy: true } },
            interviews: { select: { applicationId: true } },
          },
        },
      },
    });

    const groups = new Map<
      number,
      { vacancyId: number; vacancyTitle: string; vacancyStageId: number; vacancyStageName: string; vacancyStageOrder: number; applicationIds: Set<number> }
    >();

    for (const row of panelistRows) {
      const stage = row.slot.vacancyStage;
      let group = groups.get(stage.id);
      if (!group) {
        group = {
          vacancyId: stage.vacancy.id,
          vacancyTitle: stage.vacancy.title,
          vacancyStageId: stage.id,
          vacancyStageName: stage.name,
          vacancyStageOrder: stage.order,
          applicationIds: new Set(),
        };
        groups.set(stage.id, group);
      }
      for (const iv of row.slot.interviews) {
        group.applicationIds.add(iv.applicationId);
      }
    }

    const result = Array.from(groups.values())
      .map((g) => ({
        vacancyId: g.vacancyId,
        vacancyTitle: g.vacancyTitle,
        vacancyStageId: g.vacancyStageId,
        vacancyStageName: g.vacancyStageName,
        vacancyStageOrder: g.vacancyStageOrder,
        candidateCount: g.applicationIds.size,
      }))
      .sort((a, b) => a.vacancyTitle.localeCompare(b.vacancyTitle) || a.vacancyStageOrder - b.vacancyStageOrder);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list your vacancies" });
  }
}
