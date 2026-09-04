import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { prisma } from "../prisma.js";
import { ANCHOR_STAGES, ANCHOR_STAGE_LABELS } from "../utils/stageTransition.js";
import { aggregateByRoundOrder } from "./reports.controller.js";
import { currentStageLabel } from "../utils/stageLabel.js";
import {
  drawReportHeader,
  drawReportTitleBlock,
  drawReportSectionHeading,
  drawReportTable,
  drawReportFooter,
  ensureSpace,
  PDF_MARGIN,
} from "../utils/pdfReport.js";

// Management is department-scoped throughout this file, per the wireframe's
// "Department Recruitment" framing -- every screen here starts from
// getDepartmentVacancyIds(req.user!.department). No "switch department"
// control exists anywhere in the wireframes, so unlike the HM screens
// (which do have a Department filter dropdown), a Department filter isn't
// offered on any Management page here even where the doc's wireframe shows
// one -- there's only ever one department to filter to.
type DateRangeFilter = "7" | "30" | "90" | undefined;

function dateRangeCutoff(dateRange: DateRangeFilter): Date | null {
  if (!dateRange) return null;
  const days = Number(dateRange);
  if (Number.isNaN(days)) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Mirrors frontend/src/api/vacancy.ts's fillTimelineStatus exactly (same
// DELAYED_WARNING_WINDOW_DAYS=7 default) -- duplicated here because PDF
// generation runs server-side and can't import frontend code.
type FillTimelineStatus = "ON_TRACK" | "DELAYED" | "OVERDUE" | "NO_TARGET";
const DELAYED_WARNING_WINDOW_DAYS = 7;

function fillTimelineStatusServer(vacancy: { targetFillDate: Date | null; status: string }, now = new Date()): FillTimelineStatus {
  if (!vacancy.targetFillDate || vacancy.status !== "OPEN") return "NO_TARGET";
  const daysUntilTarget = (vacancy.targetFillDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntilTarget < 0) return "OVERDUE";
  if (daysUntilTarget <= DELAYED_WARNING_WINDOW_DAYS) return "DELAYED";
  return "ON_TRACK";
}

const STATUS_LABEL: Record<FillTimelineStatus, string> = {
  ON_TRACK: "On track",
  DELAYED: "Delayed",
  OVERDUE: "Overdue",
  NO_TARGET: "On track",
};

async function getDepartmentVacancies(department: string, filters: { dateRange?: DateRangeFilter | undefined; vacancyId?: number | undefined } = {}) {
  const cutoff = dateRangeCutoff(filters.dateRange);
  return prisma.vacancy.findMany({
    where: {
      department,
      ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
      ...(filters.vacancyId ? { id: filters.vacancyId } : {}),
    },
    include: {
      applications: { select: { stage: true, currentVacancyStageId: true } },
      stages: { select: { id: true, order: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

function daysOpenOf(vacancy: { createdAt: Date }, now = new Date()): number {
  return Math.floor((now.getTime() - vacancy.createdAt.getTime()) / (1000 * 60 * 60 * 24));
}

// Shared "is this application's current round ready for a hiring decision"
// gate -- same rule as hiringManager.controller.ts's isReadyForDecision, but
// this file doesn't import that one since it's scoped by department here,
// not by an owning hiring manager. Kept as its own small copy rather than a
// cross-controller shared util for two very similar small checks.
function currentRoundIsReady(currentRoundInterviews: { scheduledAt: Date; feedback: unknown[]; panelists: unknown[] }[]): boolean {
  if (currentRoundInterviews.length === 0) return false;
  const now = new Date();
  if (!currentRoundInterviews.every((iv) => iv.scheduledAt <= now)) return false;
  return currentRoundInterviews.every((iv) => iv.feedback.length >= iv.panelists.length);
}

// ---------------------------------------------------------------------------
// 1. Dashboard
// ---------------------------------------------------------------------------

// Minimum days an OPEN vacancy has been open before Needs Attention flags it
// -- implementation default, not a separately confirmed decision (same
// pattern as HM's COMPARE_NUDGE_THRESHOLD).
const VACANCY_AGE_NUDGE_DAYS = 30;

async function buildDashboardData(department: string, filters: { dateRange?: DateRangeFilter | undefined; vacancyId?: number | undefined }) {
  const vacancies = await getDepartmentVacancies(department, filters);
  const vacancyIds = vacancies.map((v) => v.id);

  const allApplications = vacancies.flatMap((v) => v.applications);
  const allRounds = vacancies.flatMap((v) => v.stages);
  const { anchorCounts, roundOrderCounts } = aggregateByRoundOrder(allApplications, allRounds);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [hiredThisMonth, rejectedTotal, applicationsFull] = await Promise.all([
    prisma.candidateApplication.count({
      where: { vacancyId: { in: vacancyIds }, stage: "HIRED", decidedAt: { gte: startOfMonth } },
    }),
    prisma.candidateApplication.count({ where: { vacancyId: { in: vacancyIds }, stage: "REJECTED" } }),
    // Fuller include, used below for the Needs Attention nudges (candidates
    // awaiting a decision, interviewers with overdue feedback).
    prisma.candidateApplication.findMany({
      where: { vacancyId: { in: vacancyIds }, stage: "SHORTLISTED", currentVacancyStageId: { not: null } },
      include: {
        interviews: { include: { feedback: true, slot: { include: { panelists: true } } } },
      },
    }),
  ]);

  let awaitingDecisionCount = 0;
  let missingFeedbackInterviewerIds = new Set<number>();
  for (const app of applicationsFull) {
    const currentRoundInterviews = app.interviews
      .filter((iv) => iv.slot.vacancyStageId === app.currentVacancyStageId)
      .map((iv) => ({ scheduledAt: iv.slot.scheduledAt, feedback: iv.feedback, panelists: iv.slot.panelists }));
    if (currentRoundIsReady(currentRoundInterviews)) {
      awaitingDecisionCount++;
      continue;
    }
    const now = new Date();
    for (const iv of currentRoundInterviews) {
      if (iv.scheduledAt > now) continue; // hasn't happened yet, nothing overdue
      const feedbackUserIds = new Set((iv.feedback as { interviewerId: number }[]).map((f) => f.interviewerId));
      for (const p of iv.panelists as { userId: number }[]) {
        if (!feedbackUserIds.has(p.userId)) missingFeedbackInterviewerIds.add(p.userId);
      }
    }
  }

  const now = new Date();
  const oldOpenVacancies = vacancies.filter((v) => v.status === "OPEN" && daysOpenOf(v, now) >= VACANCY_AGE_NUDGE_DAYS);

  const attentionItems: { type: "DECISION" | "FEEDBACK" | "AGEING"; label: string; link: string | null }[] = [];
  if (awaitingDecisionCount > 0) {
    attentionItems.push({
      type: "DECISION",
      label: `${awaitingDecisionCount} candidate${awaitingDecisionCount === 1 ? "" : "s"} await${awaitingDecisionCount === 1 ? "s" : ""} a decision`,
      link: "/management/candidate-progress",
    });
  }
  if (missingFeedbackInterviewerIds.size > 0) {
    attentionItems.push({
      type: "FEEDBACK",
      label: `${missingFeedbackInterviewerIds.size} interviewer${missingFeedbackInterviewerIds.size === 1 ? "" : "s"} have overdue feedback`,
      link: null,
    });
  }
  for (const v of oldOpenVacancies) {
    attentionItems.push({
      type: "AGEING",
      label: `${v.title} is open for ${daysOpenOf(v, now)} days`,
      link: "/management/vacancies",
    });
  }

  return {
    openVacancies: vacancies.filter((v) => v.status === "OPEN").length,
    activeCandidates: allApplications.filter((a) => a.stage === "SHORTLISTED").length,
    hiresThisMonth: hiredThisMonth,
    rejected: rejectedTotal,
    anchors: ANCHOR_STAGES.map((stage) => ({ stage, label: ANCHOR_STAGE_LABELS[stage], candidateCount: anchorCounts[stage] ?? 0 })),
    rounds: roundOrderCounts.map((count, i) => ({ order: i + 1, label: `Round ${i + 1}`, candidateCount: count })),
    attentionItems,
    vacancies, // kept internally for the PDF report below; trimmed before the JSON response
  };
}

export async function getManagementDashboard(req: Request, res: Response) {
  const department = req.user!.department;
  if (!department) {
    return res.json({ hasDepartment: false });
  }

  const { dateRange, vacancyId } = req.query as { dateRange?: DateRangeFilter; vacancyId?: string };

  try {
    const data = await buildDashboardData(department, { dateRange, vacancyId: vacancyId ? Number(vacancyId) : undefined });
    // Follow-up correction, reversed: attentionItems briefly had its own
    // Follow Ups tab (getManagementFollowUps), then that tab was removed
    // outright -- Management's only real responsibility is attending the
    // final round and submitting their own score/comments, which the
    // existing My Candidates tab (Pending/Submitted filter, click straight
    // to Feedback) already covers completely. A second tab surfacing
    // org-wide stats Management can't act on (other interviewers' overdue
    // feedback, vacancies open too long) never belonged to this role in the
    // first place -- that's HR's job now that HR's own Follow Ups page is
    // understood as the "chase people" hub. Still trimmed from this
    // response since the Dashboard doesn't render it either; still computed
    // above via buildDashboardData in case this needs revisiting.
    const { vacancies: _vacancies, attentionItems: _attentionItems, ...rest } = data;
    res.json({ hasDepartment: true, department, ...rest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build management dashboard" });
  }
}

// ---------------------------------------------------------------------------
// 2. Department Vacancies
// ---------------------------------------------------------------------------

export async function getDepartmentVacanciesList(req: Request, res: Response) {
  const department = req.user!.department;
  if (!department) return res.json({ hasDepartment: false });

  const { dateRange, vacancyId } = req.query as { dateRange?: DateRangeFilter; vacancyId?: string };

  try {
    const vacancies = await getDepartmentVacancies(department, { dateRange, vacancyId: vacancyId ? Number(vacancyId) : undefined });
    res.json({
      hasDepartment: true,
      vacancies: vacancies.map((v) => ({
        id: v.id,
        title: v.title,
        department: v.department,
        status: v.status,
        createdAt: v.createdAt,
        targetFillDate: v.targetFillDate,
        candidateCount: v.applications.length,
        currentStage: currentStageLabel(v.applications, v.stages),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list department vacancies" });
  }
}

// ---------------------------------------------------------------------------
// 3. Candidate Progress
// ---------------------------------------------------------------------------

// Days since this application entered its current stage -- the open
// (exitedAt: null) ApplicationStageHistory entry, falling back to appliedAt
// if there's somehow no history row yet (matches the fallback pattern used
// on the HM Pending Decisions "waitingSince" field).
function daysAtCurrentStage(app: { appliedAt: Date; stageHistory: { enteredAt: Date; exitedAt: Date | null }[] }, now = new Date()): number {
  const open = app.stageHistory.find((h) => h.exitedAt === null);
  const since = open?.enteredAt ?? app.appliedAt;
  return Math.floor((now.getTime() - since.getTime()) / (1000 * 60 * 60 * 24));
}

// Threshold before an in-progress (but not yet decision-ready) candidate is
// flagged "Delayed" instead of "In Progress" -- implementation default.
const STAGE_DELAY_DAYS = 5;

async function buildCandidateProgressData(department: string) {
  const vacancies = await getDepartmentVacancies(department);
  const vacancyIds = vacancies.map((v) => v.id);
  const allApplications = vacancies.flatMap((v) => v.applications);
  const allRounds = vacancies.flatMap((v) => v.stages);
  const { anchorCounts, roundOrderCounts } = aggregateByRoundOrder(allApplications, allRounds);

  const inProgress = await prisma.candidateApplication.findMany({
    where: { vacancyId: { in: vacancyIds }, stage: "SHORTLISTED", currentVacancyStageId: { not: null } },
    include: {
      candidate: true,
      vacancy: true,
      currentVacancyStage: true,
      stageHistory: true,
      interviews: { include: { feedback: true, slot: { include: { panelists: true } } } },
    },
    orderBy: { appliedAt: "asc" },
  });

  const rows = inProgress.map((app) => {
    const currentRoundInterviews = app.interviews
      .filter((iv) => iv.slot.vacancyStageId === app.currentVacancyStageId)
      .map((iv) => ({ scheduledAt: iv.slot.scheduledAt, feedback: iv.feedback, panelists: iv.slot.panelists }));
    const ready = currentRoundIsReady(currentRoundInterviews);
    const now = new Date();
    const interviewHappened = currentRoundInterviews.some((iv) => iv.scheduledAt <= now);
    const days = daysAtCurrentStage(app, now);

    const isFinalRound = (() => {
      const vacancyRounds = vacancies.find((v) => v.id === app.vacancyId)?.stages ?? [];
      const maxOrder = vacancyRounds.length > 0 ? Math.max(...vacancyRounds.map((r) => r.order)) : null;
      return app.currentVacancyStage?.order === maxOrder;
    })();

    // Follow-up correction: this used to be framed as "Next Action" with
    // imperative labels like "Collect Feedback" / "Schedule Interview" --
    // those read like instructions for Management to carry out, but
    // Management doesn't perform any of them (HR schedules, Interviewers
    // give feedback, the Hiring Manager decides). Reframed as "waitingOn":
    // read-only status text describing whose court the ball is in, not a
    // task for this screen's viewer.
    let waitingOn: string;
    let status: "Ready" | "Delayed" | "In Progress";
    if (ready) {
      waitingOn = isFinalRound ? "Awaiting Hiring Manager's final decision" : "Awaiting Hiring Manager's decision";
      status = "Ready";
    } else if (interviewHappened) {
      waitingOn = "Awaiting interviewer feedback";
      status = "Delayed";
    } else if (currentRoundInterviews.length === 0) {
      waitingOn = "Awaiting interview scheduling";
      status = days > STAGE_DELAY_DAYS ? "Delayed" : "In Progress";
    } else {
      waitingOn = "Interview scheduled, not yet held";
      status = "In Progress";
    }

    return {
      applicationId: app.id,
      candidate: { id: app.candidate.id, name: app.candidate.name },
      vacancy: { id: app.vacancy.id, title: app.vacancy.title },
      currentStage: app.currentVacancyStage?.name ?? "--",
      daysAtStage: days,
      waitingOn,
      status,
    };
  });

  return {
    anchors: ANCHOR_STAGES.map((stage) => ({ stage, label: ANCHOR_STAGE_LABELS[stage], candidateCount: anchorCounts[stage] ?? 0 })),
    rounds: roundOrderCounts.map((count, i) => ({ order: i + 1, label: `Round ${i + 1}`, candidateCount: count })),
    rows,
  };
}

export async function getCandidateProgress(req: Request, res: Response) {
  const department = req.user!.department;
  if (!department) return res.json({ hasDepartment: false });

  try {
    const data = await buildCandidateProgressData(department);
    res.json({ hasDepartment: true, ...data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build candidate progress" });
  }
}

// ---------------------------------------------------------------------------
// 4. Upcoming Interviews
// ---------------------------------------------------------------------------

async function buildUpcomingInterviewsData(department: string, filters: { dateRange?: DateRangeFilter | undefined; vacancyId?: number | undefined }) {
  const vacancyIds = (await getDepartmentVacancies(department, { vacancyId: filters.vacancyId })).map((v) => v.id);

  const now = new Date();
  const cutoff = dateRangeCutoff(filters.dateRange);
  // dateRange here means "within the next N days" (a look-ahead window),
  // not "created in the last N days" like the other pages -- upcoming
  // interviews are always in the future, so filtering by a past cutoff
  // wouldn't make sense. Reuses the same query-param name/values for
  // frontend consistency, just interpreted the other direction.
  const lookaheadEnd = cutoff ? new Date(now.getTime() + (now.getTime() - cutoff.getTime())) : null;

  const interviews = await prisma.interview.findMany({
    where: {
      application: { vacancyId: { in: vacancyIds } },
      slot: { scheduledAt: { gte: now, ...(lookaheadEnd ? { lte: lookaheadEnd } : {}) } },
    },
    include: {
      application: { include: { candidate: true, vacancy: true } },
      slot: { include: { vacancyStage: true } },
    },
    orderBy: { slot: { scheduledAt: "asc" } },
  });

  return interviews.map((iv) => ({
    interviewId: iv.id,
    scheduledAt: iv.slot.scheduledAt,
    candidate: { id: iv.application.candidate.id, name: iv.application.candidate.name },
    vacancy: { id: iv.application.vacancy.id, title: iv.application.vacancy.title },
    round: { name: iv.slot.vacancyStage.name, order: iv.slot.vacancyStage.order, roundLabel: iv.slot.roundLabel },
  }));
}

export async function getUpcomingInterviews(req: Request, res: Response) {
  const department = req.user!.department;
  if (!department) return res.json({ hasDepartment: false });

  const { dateRange, vacancyId } = req.query as { dateRange?: DateRangeFilter; vacancyId?: string };

  try {
    const rows = await buildUpcomingInterviewsData(department, { dateRange, vacancyId: vacancyId ? Number(vacancyId) : undefined });
    res.json({ hasDepartment: true, rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build upcoming interviews" });
  }
}

// ---------------------------------------------------------------------------
// 5. Reports (4 types, each a real PDF)
// ---------------------------------------------------------------------------

export const REPORT_TYPES = ["hiring-summary", "candidate-progress", "round-status", "vacancy-ageing"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_METADATA: Record<ReportType, { name: string }> = {
  "hiring-summary": { name: "Department Hiring Summary" },
  "candidate-progress": { name: "Candidate Progress Report" },
  "round-status": { name: "Round Status Report" },
  "vacancy-ageing": { name: "Vacancy Ageing Report" },
};

export async function listReports(req: Request, res: Response) {
  const department = req.user!.department;
  if (!department) return res.json({ hasDepartment: false });
  res.json({ hasDepartment: true, reports: REPORT_TYPES.map((type) => ({ type, name: REPORT_METADATA[type].name })) });
}

async function buildRoundStatusData(department: string) {
  const vacancies = await getDepartmentVacancies(department);
  const vacancyIds = vacancies.map((v) => v.id);
  const allApplications = vacancies.flatMap((v) => v.applications);
  const allRounds = vacancies.flatMap((v) => v.stages);
  const { roundOrderCounts } = aggregateByRoundOrder(allApplications, allRounds);

  const stageOrderById = new Map(allRounds.map((r) => [r.id, r.order]));
  const historyRows = await prisma.applicationStageHistory.findMany({
    where: { application: { vacancyId: { in: vacancyIds } }, vacancyStageId: { not: null }, exitedAt: { not: null } },
    select: { vacancyStageId: true, enteredAt: true, exitedAt: true },
  });

  const maxOrder = allRounds.reduce((max, r) => Math.max(max, r.order), 0);
  const durationsByOrder: number[][] = Array.from({ length: maxOrder }, () => []);
  for (const h of historyRows) {
    const order = stageOrderById.get(h.vacancyStageId!);
    if (order === undefined || !h.exitedAt) continue;
    const hours = (h.exitedAt.getTime() - h.enteredAt.getTime()) / (1000 * 60 * 60);
    durationsByOrder[order - 1]?.push(hours);
  }

  return Array.from({ length: maxOrder }, (_, i) => ({
    order: i + 1,
    label: `Round ${i + 1}`,
    candidatesCurrentlyIn: roundOrderCounts[i] ?? 0,
    completedCount: durationsByOrder[i]?.length ?? 0,
    averageHoursInStage:
      durationsByOrder[i] && durationsByOrder[i]!.length > 0
        ? Number((durationsByOrder[i]!.reduce((a, b) => a + b, 0) / durationsByOrder[i]!.length).toFixed(1))
        : null,
  }));
}

export async function getReportPdf(req: Request, res: Response) {
  const department = req.user!.department;
  if (!department) {
    return res.status(400).json({ error: "No department is set on your account" });
  }
  const type = req.params.type as ReportType;
  if (!REPORT_TYPES.includes(type)) {
    return res.status(400).json({ error: "Unknown report type" });
  }

  // Fetch every bit of data the PDF needs BEFORE touching the response at
  // all. This used to fetch data (buildDashboardData / etc.) interleaved
  // with drawing, after `res.setHeader(...)` + `doc.pipe(res)` had already
  // started streaming a "application/pdf" attachment -- so if that fetch (or
  // any drawing call using its result) threw, the catch block's
  // `res.status(500).json(...)` ran against a response that had already
  // sent PDF headers and possibly partial PDF bytes, corrupting the
  // download instead of returning a clean error (the browser would save a
  // broken file that then fails to open). Splitting data-fetch from
  // rendering means a failure here still gets a normal JSON error response.
  let reportData: {
    dashboard?: Awaited<ReturnType<typeof buildDashboardData>>;
    candidateProgress?: Awaited<ReturnType<typeof buildCandidateProgressData>>;
    roundStatus?: Awaited<ReturnType<typeof buildRoundStatusData>>;
    ageingVacancies?: Awaited<ReturnType<typeof getDepartmentVacancies>>;
  };
  try {
    if (type === "hiring-summary") {
      reportData = { dashboard: await buildDashboardData(department, {}) };
    } else if (type === "candidate-progress") {
      reportData = { candidateProgress: await buildCandidateProgressData(department) };
    } else if (type === "round-status") {
      reportData = { roundStatus: await buildRoundStatusData(department) };
    } else {
      reportData = { ageingVacancies: await getDepartmentVacancies(department) };
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not build report PDF" });
  }

  // Everything past this point is synchronous PDFKit drawing against
  // already-fetched, known-shaped data, so it isn't expected to throw -- but
  // it's still wrapped so a bug here logs and cleanly ends the document
  // instead of leaving the response hanging.
  try {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${type}-report.pdf"`);

    const doc = new PDFDocument({ margin: PDF_MARGIN, size: "A4" });
    doc.pipe(res);

    let y = drawReportHeader(doc, "MANAGEMENT REPORT");
    y = drawReportTitleBlock(doc, REPORT_METADATA[type].name, `${department}   |   Generated ${new Date().toLocaleDateString("en-GB")}`, y);

    if (type === "hiring-summary") {
      const data = reportData.dashboard!;
      y = drawReportSectionHeading(doc, "Key Metrics", y);
      y =
        drawReportTable(
          doc,
          PDF_MARGIN,
          y,
          [170, 170],
          [
            ["Metric", "Value"],
            ["Open Vacancies", String(data.openVacancies)],
            ["Active Candidates", String(data.activeCandidates)],
            ["Hires This Month", String(data.hiresThisMonth)],
            ["Rejected", String(data.rejected)],
          ]
        ) + 20;

      y = ensureSpace(doc, y);
      y = drawReportSectionHeading(doc, "Recruitment Progress", y);
      y =
        drawReportTable(
          doc,
          PDF_MARGIN,
          y,
          [170, 170],
          [["Stage", "Candidates"], ...data.anchors.map((a) => [a.label, String(a.candidateCount)]), ...data.rounds.map((r) => [r.label, String(r.candidateCount)])]
        ) + 20;

      y = ensureSpace(doc, y);
      y = drawReportSectionHeading(doc, "Vacancies", y);
      drawReportTable(
        doc,
        PDF_MARGIN,
        y,
        [180, 90, 90, 90],
        [
          ["Vacancy", "Status", "Candidates", "Days Open"],
          ...data.vacancies.map((v) => [v.title, v.status, String(v.applications.length), String(daysOpenOf(v))]),
        ]
      );
    } else if (type === "candidate-progress") {
      const data = reportData.candidateProgress!;
      y = drawReportSectionHeading(doc, "Stage Summary", y);
      y =
        drawReportTable(
          doc,
          PDF_MARGIN,
          y,
          [170, 170],
          [["Stage", "Candidates"], ...data.anchors.map((a) => [a.label, String(a.candidateCount)]), ...data.rounds.map((r) => [r.label, String(r.candidateCount)])]
        ) + 20;

      y = ensureSpace(doc, y);
      y = drawReportSectionHeading(doc, "Requires Attention", y);
      drawReportTable(
        doc,
        PDF_MARGIN,
        y,
        [110, 110, 90, 70, 90],
        [
          ["Candidate", "Vacancy", "Current Stage", "Days", "Status"],
          ...data.rows.map((r) => [r.candidate.name, r.vacancy.title, r.currentStage, String(r.daysAtStage), r.status]),
        ]
      );
    } else if (type === "round-status") {
      const rounds = reportData.roundStatus!;
      y = drawReportSectionHeading(doc, "Round Status", y);
      drawReportTable(
        doc,
        PDF_MARGIN,
        y,
        [110, 110, 110, 60],
        [
          ["Round", "Currently In", "Completed", "Avg. Hours"],
          ...rounds.map((r) => [r.label, String(r.candidatesCurrentlyIn), String(r.completedCount), r.averageHoursInStage !== null ? String(r.averageHoursInStage) : "N/A"]),
        ]
      );
    } else {
      const vacancies = reportData.ageingVacancies!;
      const aged = [...vacancies].sort((a, b) => daysOpenOf(b) - daysOpenOf(a));
      y = drawReportSectionHeading(doc, "Vacancy Ageing (oldest first)", y);
      drawReportTable(
        doc,
        PDF_MARGIN,
        y,
        [180, 90, 90, 90],
        [
          ["Vacancy", "Days Open", "Status", "Candidates"],
          ...aged.map((v) => [v.title, String(daysOpenOf(v)), STATUS_LABEL[fillTimelineStatusServer(v)], String(v.applications.length)]),
        ]
      );
    }

    drawReportFooter(doc, doc.y + 20);
    doc.end();
  } catch (err) {
    console.error("Error while drawing report PDF after headers were sent:", err);
    res.end();
  }
}
