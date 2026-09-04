import type { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { ANCHOR_STAGES, ANCHOR_STAGE_LABELS } from "../utils/stageTransition.js";
import { aggregateByRoundOrder } from "./reports.controller.js";
import { currentStageLabel } from "../utils/stageLabel.js";

// Locked via AskUserQuestion (see decision log, "Wireframe review: Management
// + Hiring Manager screens"): "my vacancies" = vacancies where this HM has at
// least one assigned application (CandidateApplication.hiringManagerId), not
// org-wide. Shared helper -- every HM screen starts from this same set.
//
// Optional filters mirror the ones VacanciesPage.tsx already applies
// client-side (Date Range / Department / Vacancy) -- added here too so the
// Dashboard can be scoped the same way. This is NOT because there's "one
// hiring manager for the whole company" (decision log explicitly says the
// opposite: hiringManagerId lives on CandidateApplication, not Vacancy,
// because one vacancy can have different HMs across different candidates).
// It's because a single HM's own assigned vacancies can legitimately span
// multiple departments at once (see seed-hiring-manager-screens.ts: one HM
// account with Engineering/Data/Design/Support vacancies) -- Department is a
// real, useful filter for that HM, same reasoning as Leadership's, just
// scoped to "my vacancies" instead of the whole org.
type DateRangeFilter = "30" | "90" | undefined;

function dateRangeCutoff(dateRange: DateRangeFilter): Date | null {
  if (!dateRange) return null;
  const days = Number(dateRange);
  if (Number.isNaN(days)) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function getMyVacancyIds(
  hiringManagerId: number,
  filters?: { dateRange?: DateRangeFilter; vacancyId?: number; department?: string }
): Promise<number[]> {
  const cutoff = dateRangeCutoff(filters?.dateRange);
  const rows = await prisma.candidateApplication.findMany({
    where: {
      hiringManagerId,
      vacancy: {
        ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
        ...(filters?.vacancyId ? { id: filters.vacancyId } : {}),
        ...(filters?.department ? { department: filters.department } : {}),
      },
    },
    select: { vacancyId: true },
    distinct: ["vacancyId"],
  });
  return rows.map((r) => r.vacancyId);
}

// 1. HM Dashboard. Open Vacancies / Recruitment Progress are scoped broadly
// (every application in "my vacancies", not just applications assigned to
// me personally) -- these reflect overall pipeline health for vacancies this
// HM is involved in. Awaiting My Decision / Hired / Rejected are scoped
// narrowly (only applications where hiringManagerId = me), since those are
// specifically about decisions this HM has made or owes.
// Minimum shortlisted-with-feedback candidates on one vacancy before Needs
// Attention nudges the HM to go compare them -- implementation default, not
// a separately confirmed decision (comparing 1-2 candidates isn't useful).
const COMPARE_NUDGE_THRESHOLD = 3;

export async function getMyDashboard(req: Request, res: Response) {
  const hiringManagerId = req.user!.id;
  const { dateRange, vacancyId, department } = req.query as {
    dateRange?: DateRangeFilter;
    vacancyId?: string;
    department?: string;
  };
  const filters = { dateRange, vacancyId: vacancyId ? Number(vacancyId) : undefined, department };

  try {
    const myVacancyIds = await getMyVacancyIds(hiringManagerId, filters);

    const [openVacancies, vacancyApplications, myApplicationsFull, myRounds, pendingDecisions] = await Promise.all([
      prisma.vacancy.count({ where: { id: { in: myVacancyIds }, status: "OPEN" } }),
      prisma.candidateApplication.findMany({
        where: { vacancyId: { in: myVacancyIds } },
        select: { stage: true, currentVacancyStageId: true },
      }),
      // Needs Attention below is scoped narrowly (hiringManagerId = me), same
      // as Awaiting My Decision/Hired/Rejected -- it's a personal to-do list,
      // not an org-wide feed. Fuller include than before (candidate/vacancy/
      // interviews) so the same query can also drive the missing-feedback
      // and compare-candidates nudges without extra round trips. Also scoped
      // to the filtered vacancy set, same as everything else on this page --
      // filtering to a department should filter every number shown, not just
      // the org-wide-looking ones.
      prisma.candidateApplication.findMany({
        where: { hiringManagerId, vacancyId: { in: myVacancyIds } },
        include: {
          candidate: true,
          vacancy: true,
          interviews: { include: { feedback: true, slot: { include: { panelists: true } } } },
        },
      }),
      prisma.vacancyStage.findMany({
        where: { vacancyId: { in: myVacancyIds } },
        select: { id: true, order: true },
      }),
      getPendingDecisionsForHm(hiringManagerId, myVacancyIds),
    ]);

    const { anchorCounts, roundOrderCounts } = aggregateByRoundOrder(vacancyApplications, myRounds);

    // Needs Attention, item type 1: one bullet per candidate actually waiting
    // on this HM (reuses the same "ready" rows Pending Decisions shows, just
    // itemized by name instead of collapsed into a single count).
    const decisionItems = pendingDecisions.map((r) => ({
      type: "DECISION" as const,
      label: r.isFinalRound ? `Submit final decision for ${r.candidate.name}` : `Submit decision for ${r.candidate.name}`,
      link: `/hiring-manager/applications/${r.applicationId}`,
    }));

    // Needs Attention, item type 2: interviews that happened but where at
    // least one assigned panelist still hasn't submitted feedback -- the
    // gate that's blocking a decision from becoming ready. Purely
    // informational (no HM-facing page acts on this directly, panelists
    // handle it), so no link.
    const now = new Date();
    let missingFeedbackCount = 0;
    for (const app of myApplicationsFull) {
      if (app.stage !== "SHORTLISTED" || !app.currentVacancyStageId) continue;
      const currentRoundInterviews = app.interviews
        .filter((iv) => iv.slot.vacancyStageId === app.currentVacancyStageId)
        .map((iv) => ({ scheduledAt: iv.slot.scheduledAt, feedback: iv.feedback, panelists: iv.slot.panelists }));
      if (currentRoundInterviews.length === 0) continue;
      const allHappened = currentRoundInterviews.every((iv) => iv.scheduledAt <= now);
      if (!allHappened) continue;
      const allFeedbackIn = currentRoundInterviews.every((iv) => iv.feedback.length >= iv.panelists.length);
      if (!allFeedbackIn) missingFeedbackCount++;
    }
    const feedbackItems =
      missingFeedbackCount > 0
        ? [{ type: "FEEDBACK" as const, label: `Follow up on ${missingFeedbackCount} missing feedback form${missingFeedbackCount === 1 ? "" : "s"}`, link: null }]
        : [];

    // Needs Attention, item type 3: vacancies with enough shortlisted
    // candidates to be worth comparing. Links to Candidate Comparison with
    // that vacancy pre-selected.
    const shortlistedCountByVacancy = new Map<number, { vacancyId: number; vacancyTitle: string; count: number }>();
    for (const app of myApplicationsFull) {
      if (app.stage !== "SHORTLISTED") continue;
      const entry = shortlistedCountByVacancy.get(app.vacancyId) ?? { vacancyId: app.vacancyId, vacancyTitle: app.vacancy.title, count: 0 };
      entry.count++;
      shortlistedCountByVacancy.set(app.vacancyId, entry);
    }
    const compareItems = [...shortlistedCountByVacancy.values()]
      .filter((v) => v.count >= COMPARE_NUDGE_THRESHOLD)
      .map((v) => ({
        type: "COMPARE" as const,
        label: `Compare ${v.count} ${v.vacancyTitle} candidates`,
        link: `/hiring-manager/candidate-comparison?vacancyId=${v.vacancyId}`,
      }));

    res.json({
      openVacancies,
      awaitingMyDecision: pendingDecisions.length,
      hired: myApplicationsFull.filter((a) => a.stage === "HIRED").length,
      rejected: myApplicationsFull.filter((a) => a.stage === "REJECTED").length,
      anchors: ANCHOR_STAGES.map((stage) => ({
        stage,
        label: ANCHOR_STAGE_LABELS[stage],
        candidateCount: anchorCounts[stage] ?? 0,
      })),
      rounds: roundOrderCounts.map((count, i) => ({ order: i + 1, label: `Round ${i + 1}`, candidateCount: count })),
      attentionItems: [...decisionItems, ...compareItems, ...feedbackItems],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build hiring manager dashboard" });
  }
}

// 2. HM Vacancies list -- Days Open/Status (On Track/Delayed/Overdue) are
// derived client-side from createdAt/targetFillDate (see frontend/src/api/
// vacancy.ts fillTimelineStatus/daysOpen) so this just returns the raw
// fields plus the two things that need a real query: candidate count and
// the current-stage label above.
export async function getMyVacancies(req: Request, res: Response) {
  const hiringManagerId = req.user!.id;

  try {
    const myVacancyIds = await getMyVacancyIds(hiringManagerId);

    const vacancies = await prisma.vacancy.findMany({
      where: { id: { in: myVacancyIds } },
      include: {
        applications: { select: { stage: true, currentVacancyStageId: true } },
        stages: { select: { id: true, order: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      vacancies.map((v) => ({
        id: v.id,
        title: v.title,
        department: v.department,
        status: v.status,
        createdAt: v.createdAt,
        targetFillDate: v.targetFillDate,
        candidateCount: v.applications.length,
        currentStage: currentStageLabel(v.applications, v.stages),
        // Corrections doc: vacancies where the HM has made every decision
        // sink to the bottom of the list client-side. "Made every decision"
        // = no candidate left in an active (non-final) stage -- a vacancy
        // with zero candidates isn't "decided", it just hasn't started.
        allDecided: v.applications.length > 0 && v.applications.every((a) => a.stage === "HIRED" || a.stage === "REJECTED"),
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list your vacancies" });
  }
}

// Shared "is this candidate's current round actually ready for an HM
// decision" gate -- extracted so getPendingDecisionsForHm (the flat queue)
// and getApplicationForDecision (the per-candidate drill-down page) can
// never disagree about when the Proceed/Do Not Proceed/Hire/Reject buttons
// should be active. A round is ready once every interview scheduled for it
// has happened AND every assigned panelist for those interviews has
// submitted feedback.
type FlattenedInterview = {
  vacancyStageId: number;
  scheduledAt: Date;
  feedback: { score: number; comments: string; interviewerId: number; interviewer: { id: number; name: string } }[];
  panelists: { id: number }[];
};

function isReadyForDecision(currentRoundInterviews: FlattenedInterview[]): boolean {
  if (currentRoundInterviews.length === 0) return false; // no interview yet for this round
  const now = new Date();
  const allHappened = currentRoundInterviews.every((iv) => iv.scheduledAt <= now);
  if (!allHappened) return false;
  return currentRoundInterviews.every((iv) => iv.feedback.length >= iv.panelists.length);
}

// Shared by getMyDashboard's "Awaiting My Decision" count and
// getMyPendingDecisions' actual list -- kept as one function so the count
// and the list can never disagree.
async function getPendingDecisionsForHm(hiringManagerId: number, vacancyIds?: number[]) {
  const applications = await prisma.candidateApplication.findMany({
    where: {
      hiringManagerId,
      stage: "SHORTLISTED",
      currentVacancyStageId: { not: null },
      ...(vacancyIds ? { vacancyId: { in: vacancyIds } } : {}),
    },
    include: {
      candidate: true,
      vacancy: true,
      currentVacancyStage: true,
      // feedback.interviewer + interviews.vacancyStage are only needed for
      // feedbackHistory below (US-25) -- everything else here was already
      // being fetched for the scoring/readiness checks.
      //
      // Schema split Interview into InterviewSlot (time/panel/round) +
      // Interview (one candidate's participation) -- panelists/vacancyStage/
      // scheduledAt now live on `.slot`, fetched here and flattened right
      // back onto each interview below so the readiness-gate/scoring logic
      // further down (which reads iv.vacancyStageId/.vacancyStage/
      // .scheduledAt/.panelists directly) didn't need to change at all.
      interviews: {
        include: {
          feedback: { include: { interviewer: { select: { id: true, name: true } } } },
          slot: { include: { panelists: true, vacancyStage: true } },
        },
      },
      stageHistory: { where: { exitedAt: null }, orderBy: { enteredAt: "desc" }, take: 1 },
    },
  });

  // Plain inline map (not a separately-typed generic helper) so TypeScript
  // infers app/iv directly from the concrete Prisma result type above --
  // a generic helper here type-checked incorrectly (couldn't narrow
  // "everything except slot" cleanly against an abstract type parameter).
  const flattenedApplications = applications.map((app) => ({
    ...app,
    interviews: app.interviews.map((iv) => {
      const { slot, ...rest } = iv;
      return { ...rest, vacancyStageId: slot.vacancyStageId, scheduledAt: slot.scheduledAt, vacancyStage: slot.vacancyStage, panelists: slot.panelists };
    }),
  }));

  const rows: {
    applicationId: number;
    candidate: { id: number; name: string };
    vacancy: { id: number; title: string };
    round: { id: number; name: string; order: number };
    isFinalRound: boolean;
    score: number | null;
    commentsAvailable: boolean;
    comments: string[];
    waitingSince: Date;
    // US-25: shared interview feedback visibility -- every round this
    // application has been through so far, each interview's feedback
    // attributed to the interviewer who gave it (not just an anonymous
    // aggregate). Separate from `score`/`comments` above, which stay
    // scoped to the current round only per the locked "latest round only"
    // scoring decision -- this is about visibility, not scoring.
    feedbackHistory: {
      round: { id: number; name: string; order: number };
      scheduledAt: Date;
      entries: { interviewerId: number; interviewerName: string; score: number; comments: string }[];
    }[];
  }[] = [];

  for (const app of flattenedApplications) {
    const currentRoundId = app.currentVacancyStageId!;
    // Only interviews for the CURRENT round -- "latest round only" per the
    // locked decision (user picked this over averaging across all rounds).
    const currentRoundInterviews = app.interviews.filter((iv) => iv.vacancyStageId === currentRoundId);
    if (!isReadyForDecision(currentRoundInterviews)) continue; // not scheduled/happened/fully-fed-back yet

    const allScores = currentRoundInterviews.flatMap((iv) => iv.feedback.map((f) => f.score));
    const allComments = currentRoundInterviews.flatMap((iv) => iv.feedback.map((f) => f.comments));
    const avgScore = allScores.length > 0 ? Number((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)) : null;

    const feedbackHistory = app.interviews
      .filter((iv) => iv.feedback.length > 0)
      .sort((a, b) => a.vacancyStage.order - b.vacancyStage.order || a.scheduledAt.getTime() - b.scheduledAt.getTime())
      .map((iv) => ({
        round: { id: iv.vacancyStage.id, name: iv.vacancyStage.name, order: iv.vacancyStage.order },
        scheduledAt: iv.scheduledAt,
        entries: iv.feedback.map((f) => ({
          interviewerId: f.interviewerId,
          interviewerName: f.interviewer.name,
          score: f.score,
          comments: f.comments,
        })),
      }));

    // Vacancy's rounds aren't loaded here -- fetched once below for all rows
    // together instead of N+1 querying per application.
    rows.push({
      applicationId: app.id,
      candidate: { id: app.candidate.id, name: app.candidate.name },
      vacancy: { id: app.vacancy.id, title: app.vacancy.title },
      round: { id: app.currentVacancyStage!.id, name: app.currentVacancyStage!.name, order: app.currentVacancyStage!.order },
      isFinalRound: false, // filled in by the caller once it knows each vacancy's max round order
      score: avgScore,
      commentsAvailable: allComments.length > 0,
      comments: allComments,
      waitingSince: app.stageHistory[0]?.enteredAt ?? app.appliedAt,
      feedbackHistory,
    });
  }

  if (rows.length === 0) return rows;

  // Resolve isFinalRound per row now that we have the full set -- a round is
  // final if its order is the max order among that vacancy's configured
  // rounds (matches recordHiringDecision's own "must be at the last round"
  // check, so the frontend shows Hire/Reject vs Advance/Do Not Progress
  // consistently with what the backend will actually accept).
  const resultVacancyIds = [...new Set(rows.map((r) => r.vacancy.id))];
  const allRounds = await prisma.vacancyStage.findMany({ where: { vacancyId: { in: resultVacancyIds } }, select: { vacancyId: true, order: true } });
  const maxOrderByVacancy = new Map<number, number>();
  for (const r of allRounds) {
    maxOrderByVacancy.set(r.vacancyId, Math.max(maxOrderByVacancy.get(r.vacancyId) ?? 0, r.order));
  }
  for (const row of rows) {
    row.isFinalRound = row.round.order === maxOrderByVacancy.get(row.vacancy.id);
  }

  return rows;
}

// 3. HM Candidate Comparison. "System automatically selects the top
// shortlisted candidates" (user's explicit instruction) -- not every
// shortlisted candidate, just the top TOP_N by score. Score per candidate =
// their LATEST round that has at least one feedback submitted (consistent
// with the "latest round only" scoring decision locked for Pending
// Decisions), but unlike Pending Decisions this doesn't require every
// panelist to have submitted yet -- comparison is exploratory, not a
// decision gate, so partial feedback for the current round still counts,
// and falls back to the last round that actually has any feedback if the
// current one has none yet. A candidate with zero feedback anywhere can't be
// ranked and is excluded entirely.
const TOP_N = 5;

async function getScoredShortlistedCandidates(vacancyId: number) {
  const applications = await prisma.candidateApplication.findMany({
    where: { vacancyId, stage: "SHORTLISTED" },
    include: {
      candidate: true,
      // vacancyStage now lives on the slot (see schema.prisma) -- flattened
      // back onto each interview below.
      interviews: { include: { feedback: true, slot: { include: { vacancyStage: true } } } },
    },
  });

  const scored: {
    applicationId: number;
    candidateId: number;
    name: string;
    score: number;
    round: { id: number; name: string; order: number };
    comments: string[];
  }[] = [];

  for (const app of applications) {
    const byRound = new Map<number, { round: { id: number; name: string; order: number }; scores: number[]; comments: string[] }>();
    for (const iv of app.interviews) {
      if (iv.feedback.length === 0) continue;
      const vacancyStageId = iv.slot.vacancyStageId;
      const existing = byRound.get(vacancyStageId) ?? {
        round: { id: iv.slot.vacancyStage.id, name: iv.slot.vacancyStage.name, order: iv.slot.vacancyStage.order },
        scores: [] as number[],
        comments: [] as string[],
      };
      existing.scores.push(...iv.feedback.map((f) => f.score));
      existing.comments.push(...iv.feedback.map((f) => f.comments));
      byRound.set(vacancyStageId, existing);
    }
    if (byRound.size === 0) continue; // no feedback anywhere yet -- can't rank

    const latest = [...byRound.values()].sort((a, b) => b.round.order - a.round.order)[0]!;
    const score = Number((latest.scores.reduce((a, b) => a + b, 0) / latest.scores.length).toFixed(1));

    scored.push({
      applicationId: app.id,
      candidateId: app.candidate.id,
      name: app.candidate.name,
      score,
      round: latest.round,
      comments: latest.comments,
    });
  }

  return scored;
}

// Corrections doc: whole numbers, not "9.0" -- "9-10" instead of "9.0-10",
// etc. The decimal upper bounds (8.9, 7.9) stay since those buckets are
// genuinely fractional ranges, not whole numbers being padded with ".0".
// Follow-up correction: scores are whole integers only (see isValidScore in
// feedback.controller.ts, 1-10, no half-points), so a decimal upper bound
// like "8.9999" was never reachable data -- it just made the label look
// like it should read "8-8.9". Labels are plain whole numbers now; the
// min/max bounds are unchanged (still correctly bucket every integer score).
// Follow-up correction: 9 and 10 used to share one "9-10" bucket -- split
// into their own buckets (exact-equality bounds work fine here since scores
// are always whole integers) so every score 7-10 gets its own row.
const SCORE_BUCKETS = [
  { label: "10", min: 10, max: 10 },
  { label: "9", min: 9, max: 9 },
  { label: "8", min: 8, max: 8 },
  { label: "7", min: 7, max: 7 },
  { label: "Below 7", min: -Infinity, max: 6.9999 },
];

export async function getComparison(req: Request, res: Response) {
  const vacancyId = Number(req.params.vacancyId);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  try {
    const myVacancyIds = await getMyVacancyIds(req.user!.id);
    if (!myVacancyIds.includes(vacancyId)) {
      return res.status(403).json({ error: "You don't have an assigned application on this vacancy" });
    }

    const vacancy = await prisma.vacancy.findUnique({ where: { id: vacancyId }, select: { id: true, title: true } });
    if (!vacancy) {
      return res.status(404).json({ error: "Vacancy not found" });
    }

    const scored = await getScoredShortlistedCandidates(vacancyId);
    const top = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N)
      .map((c, i) => ({ ...c, rank: i + 1 }));

    const scores = top.map((c) => c.score);
    const summary = {
      topCandidateCount: top.length,
      averageScore: scores.length > 0 ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : null,
      highestScore: scores.length > 0 ? Math.max(...scores) : null,
    };

    const distribution = SCORE_BUCKETS.map((b) => ({
      label: b.label,
      count: top.filter((c) => c.score >= b.min && c.score <= b.max).length,
    }));

    const comments = top.slice(0, 3).map((c) => ({ candidateId: c.candidateId, name: c.name, comments: c.comments }));

    res.json({ vacancy, topCandidates: top, summary, distribution, comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build candidate comparison" });
  }
}

// 4. HM Pending Decisions screen. "Ready" trigger locked via AskUserQuestion:
// automatic, based on every assigned panelist having submitted feedback for
// the application's current round -- no manual "mark ready" flag anywhere.
export async function getMyPendingDecisions(req: Request, res: Response) {
  try {
    const rows = await getPendingDecisionsForHm(req.user!.id);
    res.json(
      rows
        .sort((a, b) => new Date(a.waitingSince).getTime() - new Date(b.waitingSince).getTime())
        .map((r) => ({ ...r, score: r.score }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build pending decisions" });
  }
}

// 4b. HM Decision History (corrections doc, new tab, additive to Pending
// Decisions). Every application this HM has ever acted on, one row each --
// bucketed HIRED / PROCEED / REJECTED, in that display order, and a hired
// candidate is only ever in the HIRED bucket even though they necessarily
// passed through one or more earlier ADVANCE ("Proceed") decisions to get
// there ("they have excelled from proceed and now in hired", per the doc).
//
// HIRE/REJECT (final-round decisions, via recordHiringDecision) write
// hiringDecision/decidedByUserId/decidedAt directly onto CandidateApplication
// and never create a StageRecommendation row. ADVANCE/DO_NOT_PROGRESS
// (non-final, via submitStageRecommendation) do the opposite -- they create a
// StageRecommendation row and DO_NOT_PROGRESS also sets stage: REJECTED (see
// submitStageRecommendation). That means a plain `stage === "REJECTED"` check
// can't tell a final-round straight Reject apart from a mid-pipeline Do Not
// Proceed -- the presence of a DO_NOT_PROGRESS recommendation row is the only
// signal that distinguishes them, so that's what buckets it as PROCEED
// (grouped with Do Not Proceed, per the doc's stated order) instead of
// REJECTED.
export async function getMyDecisionHistory(req: Request, res: Response) {
  const hiringManagerId = req.user!.id;

  try {
    const applications = await prisma.candidateApplication.findMany({
      where: {
        hiringManagerId,
        OR: [
          { stage: "HIRED" },
          { stage: "REJECTED" },
          { stage: "SHORTLISTED", recommendations: { some: { recommendation: "ADVANCE" } } },
        ],
      },
      include: {
        candidate: true,
        vacancy: true,
        recommendations: { orderBy: { createdAt: "desc" } },
      },
    });

    type Bucket = "HIRED" | "PROCEED" | "REJECTED";
    const bucketOrder: Record<Bucket, number> = { HIRED: 0, PROCEED: 1, REJECTED: 2 };

    const rows = applications.map((app) => {
      const latestRecommendation = app.recommendations[0] ?? null;
      const hasDoNotProgress = app.recommendations.some((r) => r.recommendation === "DO_NOT_PROGRESS");

      let bucket: Bucket;
      let outcome: string;
      let decidedAt: Date;
      let comments: string | null;

      if (app.stage === "HIRED") {
        bucket = "HIRED";
        outcome = "Hired";
        decidedAt = app.decidedAt ?? latestRecommendation?.createdAt ?? app.appliedAt;
        comments = latestRecommendation?.comments ?? null;
      } else if (app.stage === "REJECTED" && hasDoNotProgress) {
        bucket = "PROCEED";
        outcome = "Do Not Proceed";
        decidedAt = latestRecommendation?.createdAt ?? app.appliedAt;
        comments = latestRecommendation?.comments ?? null;
      } else if (app.stage === "REJECTED") {
        bucket = "REJECTED";
        outcome = "Rejected";
        decidedAt = app.decidedAt ?? app.appliedAt;
        comments = null; // recordHiringDecision has no comments column (see application.controller.ts)
      } else {
        // SHORTLISTED with at least one ADVANCE recommendation on record --
        // still mid-pipeline, but the HM has made a call on them.
        bucket = "PROCEED";
        outcome = "Proceed";
        decidedAt = latestRecommendation?.createdAt ?? app.appliedAt;
        comments = latestRecommendation?.comments ?? null;
      }

      return {
        applicationId: app.id,
        candidate: { id: app.candidate.id, name: app.candidate.name },
        vacancy: { id: app.vacancy.id, title: app.vacancy.title },
        bucket,
        outcome,
        decidedAt,
        comments,
      };
    });

    rows.sort(
      (a, b) => bucketOrder[a.bucket] - bucketOrder[b.bucket] || new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime()
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build decision history" });
  }
}

// 5. HM Vacancy Candidates drill-down (corrections doc: Vacancies -> click a
// vacancy -> full candidate list -> click a candidate -> decision page).
// Deliberately broad (every candidate on the vacancy, not just ones this HM
// is personally assigned to) -- same scoping as getMyVacancies/Recruitment
// Progress, since this is a browsing view, not a personal action queue like
// Pending Decisions.
export async function getVacancyCandidates(req: Request, res: Response) {
  const vacancyId = Number(req.params.vacancyId);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  try {
    const myVacancyIds = await getMyVacancyIds(req.user!.id);
    if (!myVacancyIds.includes(vacancyId)) {
      return res.status(403).json({ error: "You don't have an assigned application on this vacancy" });
    }

    const applications = await prisma.candidateApplication.findMany({
      where: { vacancyId },
      include: {
        candidate: true,
        currentVacancyStage: true,
        interviews: {
          include: {
            feedback: { include: { interviewer: { select: { id: true, name: true } } } },
            slot: { include: { panelists: true, vacancyStage: true } },
          },
        },
      },
      orderBy: { appliedAt: "asc" },
    });

    res.json(
      applications.map((app) => {
        const currentRoundInterviews = app.interviews
          .filter((iv) => iv.slot.vacancyStageId === app.currentVacancyStageId)
          .map((iv) => ({ ...iv, vacancyStageId: iv.slot.vacancyStageId, scheduledAt: iv.slot.scheduledAt, panelists: iv.slot.panelists }));

        return {
          applicationId: app.id,
          candidate: { id: app.candidate.id, name: app.candidate.name, email: app.candidate.email },
          stage: app.stage,
          round: app.currentVacancyStage
            ? { id: app.currentVacancyStage.id, name: app.currentVacancyStage.name, order: app.currentVacancyStage.order }
            : null,
          awaitingDecision: app.stage === "SHORTLISTED" && isReadyForDecision(currentRoundInterviews),
        };
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list this vacancy's candidates" });
  }
}

// 6. HM Candidate Decision page -- the per-candidate drill-down target.
// Generalizes getPendingDecisionsForHm's per-application view to work for
// ANY candidate on a vacancy this HM has access to, not just ones currently
// sitting in the ready-for-decision queue: a candidate who's still mid-round
// (or already HIRED/REJECTED) gets the same page, just with
// awaitingDecision: false so the frontend renders it read-only.
export async function getApplicationForDecision(req: Request, res: Response) {
  const applicationId = Number(req.params.id);
  if (Number.isNaN(applicationId)) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  try {
    const myVacancyIds = await getMyVacancyIds(req.user!.id);

    const app = await prisma.candidateApplication.findUnique({
      where: { id: applicationId },
      include: {
        candidate: true,
        vacancy: true,
        currentVacancyStage: true,
        interviews: {
          include: {
            feedback: { include: { interviewer: { select: { id: true, name: true } } } },
            slot: { include: { panelists: true, vacancyStage: true } },
          },
        },
        stageHistory: { where: { exitedAt: null }, orderBy: { enteredAt: "desc" }, take: 1 },
      },
    });

    if (!app) {
      return res.status(404).json({ error: "Application not found" });
    }
    if (!myVacancyIds.includes(app.vacancyId)) {
      return res.status(403).json({ error: "You don't have an assigned application on this vacancy" });
    }

    const flattenedInterviews = app.interviews.map((iv) => {
      const { slot, ...rest } = iv;
      return { ...rest, vacancyStageId: slot.vacancyStageId, scheduledAt: slot.scheduledAt, vacancyStage: slot.vacancyStage, panelists: slot.panelists };
    });

    const rounds = await prisma.vacancyStage.findMany({ where: { vacancyId: app.vacancyId }, orderBy: { order: "asc" } });
    const maxOrder = rounds.length > 0 ? Math.max(...rounds.map((r) => r.order)) : null;
    const isFinalRound = app.currentVacancyStage !== null && app.currentVacancyStage.order === maxOrder;

    let awaitingDecision = false;
    let score: number | null = null;
    let comments: string[] = [];
    if (app.stage === "SHORTLISTED" && app.currentVacancyStageId) {
      const currentRoundInterviews = flattenedInterviews.filter((iv) => iv.vacancyStageId === app.currentVacancyStageId);
      awaitingDecision = isReadyForDecision(currentRoundInterviews);
      if (awaitingDecision) {
        const scores = currentRoundInterviews.flatMap((iv) => iv.feedback.map((f) => f.score));
        comments = currentRoundInterviews.flatMap((iv) => iv.feedback.map((f) => f.comments));
        score = scores.length > 0 ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : null;
      }
    }

    // Same shape as getPendingDecisionsForHm's feedbackHistory (US-25) --
    // every round so far, attributed per-interviewer.
    const feedbackHistory = flattenedInterviews
      .filter((iv) => iv.feedback.length > 0)
      .sort((a, b) => a.vacancyStage.order - b.vacancyStage.order || a.scheduledAt.getTime() - b.scheduledAt.getTime())
      .map((iv) => ({
        round: { id: iv.vacancyStage.id, name: iv.vacancyStage.name, order: iv.vacancyStage.order },
        scheduledAt: iv.scheduledAt,
        entries: iv.feedback.map((f) => ({
          interviewerId: f.interviewerId,
          interviewerName: f.interviewer.name,
          score: f.score,
          comments: f.comments,
        })),
      }));

    res.json({
      applicationId: app.id,
      candidate: { id: app.candidate.id, name: app.candidate.name },
      vacancy: { id: app.vacancy.id, title: app.vacancy.title },
      stage: app.stage,
      round: app.currentVacancyStage
        ? { id: app.currentVacancyStage.id, name: app.currentVacancyStage.name, order: app.currentVacancyStage.order }
        : null,
      isFinalRound,
      awaitingDecision,
      score,
      commentsAvailable: comments.length > 0,
      comments,
      waitingSince: app.stageHistory[0]?.enteredAt ?? app.appliedAt,
      feedbackHistory,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load this candidate" });
  }
}
