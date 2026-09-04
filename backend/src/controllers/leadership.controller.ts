import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { prisma } from "../prisma.js";
import { ANCHOR_STAGES, ANCHOR_STAGE_LABELS } from "../utils/stageTransition.js";
import { aggregateByRoundOrder } from "./reports.controller.js";
import {
  drawReportHeader,
  drawReportTitleBlock,
  drawReportSectionHeading,
  drawReportTable,
  drawReportFooter,
  ensureSpace,
  PDF_MARGIN,
} from "../utils/pdfReport.js";

// Leadership is org-wide (no department scoping, unlike Management) -- every
// endpoint here accepts an OPTIONAL department filter instead of being
// locked to one, per the wireframe's 3-filter row (Date Range/Department/
// Vacancy) actually including a real Department dropdown here (Management's
// doesn't, since it only ever has one department to look at).
type DateRangeFilter = "7" | "30" | "90" | undefined;
type ScopeFilters = { dateRange?: DateRangeFilter; department?: string | undefined; vacancyId?: number | undefined };

function dateRangeCutoff(dateRange: DateRangeFilter): Date | null {
  if (!dateRange) return null;
  const days = Number(dateRange);
  if (Number.isNaN(days)) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

type FillTimelineStatus = "ON_TRACK" | "DELAYED" | "OVERDUE" | "NO_TARGET";
const DELAYED_WARNING_WINDOW_DAYS = 7;

// Mirrors frontend/src/api/vacancy.ts's fillTimelineStatus (see the same
// duplication note in management.controller.ts -- PDF generation runs
// server-side and can't import frontend code).
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

async function getScopedVacancies(filters: ScopeFilters = {}) {
  const cutoff = dateRangeCutoff(filters.dateRange);
  return prisma.vacancy.findMany({
    where: {
      ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
      ...(filters.department ? { department: filters.department } : {}),
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

// Same decision-readiness gate as management.controller.ts's
// currentRoundIsReady / hiringManager.controller.ts's isReadyForDecision --
// kept as its own small copy rather than a cross-controller shared util.
function currentRoundIsReady(currentRoundInterviews: { scheduledAt: Date; feedback: unknown[]; panelists: unknown[] }[]): boolean {
  if (currentRoundInterviews.length === 0) return false;
  const now = new Date();
  if (!currentRoundInterviews.every((iv) => iv.scheduledAt <= now)) return false;
  return currentRoundInterviews.every((iv) => iv.feedback.length >= iv.panelists.length);
}

async function listAllDepartments(): Promise<string[]> {
  const rows = await prisma.vacancy.findMany({ select: { department: true }, distinct: ["department"] });
  return rows.map((r) => r.department).sort();
}

// ---------------------------------------------------------------------------
// 1. Dashboard
// ---------------------------------------------------------------------------

const VACANCY_AGE_NUDGE_DAYS = 30;

async function buildDashboardData(filters: ScopeFilters) {
  const vacancies = await getScopedVacancies(filters);
  const vacancyIds = vacancies.map((v) => v.id);
  const allApplications = vacancies.flatMap((v) => v.applications);
  const allRounds = vacancies.flatMap((v) => v.stages);
  const { anchorCounts, roundOrderCounts } = aggregateByRoundOrder(allApplications, allRounds);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [hiredThisMonth, rejectedTotal, applicationsFull] = await Promise.all([
    prisma.candidateApplication.count({ where: { vacancyId: { in: vacancyIds }, stage: "HIRED", decidedAt: { gte: startOfMonth } } }),
    prisma.candidateApplication.count({ where: { vacancyId: { in: vacancyIds }, stage: "REJECTED" } }),
    prisma.candidateApplication.findMany({
      where: { vacancyId: { in: vacancyIds }, stage: "SHORTLISTED", currentVacancyStageId: { not: null } },
      include: { interviews: { include: { feedback: true, slot: { include: { panelists: true } } } } },
    }),
  ]);

  let awaitingDecisionCount = 0;
  const missingFeedbackInterviewerIds = new Set<number>();
  const now = new Date();
  for (const app of applicationsFull) {
    const currentRoundInterviews = app.interviews
      .filter((iv) => iv.slot.vacancyStageId === app.currentVacancyStageId)
      .map((iv) => ({ scheduledAt: iv.slot.scheduledAt, feedback: iv.feedback, panelists: iv.slot.panelists }));
    if (currentRoundIsReady(currentRoundInterviews)) {
      awaitingDecisionCount++;
      continue;
    }
    for (const iv of currentRoundInterviews) {
      if (iv.scheduledAt > now) continue;
      const feedbackUserIds = new Set((iv.feedback as { interviewerId: number }[]).map((f) => f.interviewerId));
      for (const p of iv.panelists as { userId: number }[]) {
        if (!feedbackUserIds.has(p.userId)) missingFeedbackInterviewerIds.add(p.userId);
      }
    }
  }

  const oldOpenVacancies = vacancies.filter((v) => v.status === "OPEN" && daysOpenOf(v, now) >= VACANCY_AGE_NUDGE_DAYS);

  // Follow-up correction: this link used to point at
  // /leadership-management/recruitment-progress, but that page (and its nav
  // item) was removed in an earlier pass ("Leadership: remove Recruitment
  // Progress page") -- the link had gone dead without anyone noticing since
  // nothing exercised it until this item got its own dedicated Follow Ups
  // page. No replacement page shows this per-candidate detail for
  // Leadership, so null, same as the FEEDBACK item below.
  const attentionItems: { type: "DECISION" | "FEEDBACK" | "AGEING"; label: string; link: string | null }[] = [];
  if (awaitingDecisionCount > 0) {
    attentionItems.push({
      type: "DECISION",
      label: `${awaitingDecisionCount} candidate${awaitingDecisionCount === 1 ? "" : "s"} await${awaitingDecisionCount === 1 ? "s" : ""} a decision`,
      link: null,
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
    attentionItems.push({ type: "AGEING", label: `${v.title} is open for ${daysOpenOf(v, now)} days`, link: null });
  }

  return {
    openVacancies: vacancies.filter((v) => v.status === "OPEN").length,
    activeCandidates: allApplications.filter((a) => a.stage === "SHORTLISTED").length,
    hiresThisMonth: hiredThisMonth,
    rejected: rejectedTotal,
    anchors: ANCHOR_STAGES.map((stage) => ({ stage, label: ANCHOR_STAGE_LABELS[stage], candidateCount: anchorCounts[stage] ?? 0 })),
    rounds: roundOrderCounts.map((count, i) => ({ order: i + 1, label: `Round ${i + 1}`, candidateCount: count })),
    attentionItems,
    vacancies,
  };
}

export async function getLeadershipDashboard(req: Request, res: Response) {
  const { dateRange, department, vacancyId } = req.query as { dateRange?: DateRangeFilter; department?: string; vacancyId?: string };
  try {
    const data = await buildDashboardData({ dateRange, department, vacancyId: vacancyId ? Number(vacancyId) : undefined });
    const { vacancies: _vacancies, ...rest } = data;
    res.json(rest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build leadership dashboard" });
  }
}

export async function listLeadershipDepartments(_req: Request, res: Response) {
  try {
    res.json({ departments: await listAllDepartments() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list departments" });
  }
}

export async function listLeadershipVacancies(req: Request, res: Response) {
  const { department } = req.query as { department?: string };
  try {
    const vacancies = await getScopedVacancies({ department });
    res.json({ vacancies: vacancies.map((v) => ({ id: v.id, title: v.title, department: v.department })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list vacancies" });
  }
}

// ---------------------------------------------------------------------------
// 2. Recruitment Progress (org-wide Candidate Progress -- confirmed via
// AskUserQuestion: the wireframe's own "Recruitment Progress" mockup content
// didn't match its label, so this reuses Management's Candidate Progress
// pattern instead, just without the department lock.)
// ---------------------------------------------------------------------------

function daysAtCurrentStage(app: { appliedAt: Date; stageHistory: { enteredAt: Date; exitedAt: Date | null }[] }, now = new Date()): number {
  const open = app.stageHistory.find((h) => h.exitedAt === null);
  const since = open?.enteredAt ?? app.appliedAt;
  return Math.floor((now.getTime() - since.getTime()) / (1000 * 60 * 60 * 24));
}

const STAGE_DELAY_DAYS = 5;

async function buildRecruitmentProgressData(filters: ScopeFilters) {
  const vacancies = await getScopedVacancies(filters);
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

    let nextAction: string;
    let status: "Ready" | "Delayed" | "In Progress";
    if (ready) {
      nextAction = isFinalRound ? "Hiring Decision" : "Advance Decision";
      status = "Ready";
    } else if (interviewHappened) {
      nextAction = "Collect Feedback";
      status = "Delayed";
    } else if (currentRoundInterviews.length === 0) {
      nextAction = "Schedule Interview";
      status = days > STAGE_DELAY_DAYS ? "Delayed" : "In Progress";
    } else {
      nextAction = "Awaiting Interview";
      status = "In Progress";
    }

    return {
      applicationId: app.id,
      candidate: { id: app.candidate.id, name: app.candidate.name },
      vacancy: { id: app.vacancy.id, title: app.vacancy.title, department: app.vacancy.department },
      currentStage: app.currentVacancyStage?.name ?? "--",
      daysAtStage: days,
      nextAction,
      status,
    };
  });

  return {
    anchors: ANCHOR_STAGES.map((stage) => ({ stage, label: ANCHOR_STAGE_LABELS[stage], candidateCount: anchorCounts[stage] ?? 0 })),
    rounds: roundOrderCounts.map((count, i) => ({ order: i + 1, label: `Round ${i + 1}`, candidateCount: count })),
    rows,
  };
}

export async function getRecruitmentProgress(req: Request, res: Response) {
  const { dateRange, department, vacancyId } = req.query as { dateRange?: DateRangeFilter; department?: string; vacancyId?: string };
  try {
    const data = await buildRecruitmentProgressData({ dateRange, department, vacancyId: vacancyId ? Number(vacancyId) : undefined });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build recruitment progress" });
  }
}

// ---------------------------------------------------------------------------
// 3. Department Performance
// ---------------------------------------------------------------------------

async function buildDepartmentPerformanceData(filters: ScopeFilters) {
  const vacancies = await getScopedVacancies(filters);
  const departments = [...new Set(vacancies.map((v) => v.department))];

  const hiredApps = await prisma.candidateApplication.findMany({
    where: { vacancyId: { in: vacancies.map((v) => v.id) }, stage: "HIRED" },
    include: { vacancy: { select: { department: true } } },
  });
  const rejectedApps = await prisma.candidateApplication.findMany({
    where: { vacancyId: { in: vacancies.map((v) => v.id) }, stage: "REJECTED" },
    include: { vacancy: { select: { department: true } } },
  });

  const byDept = new Map<
    string,
    { department: string; totalVacancies: number; closedVacancies: number; openVacancies: number; overdueVacancies: number; hired: number; rejected: number; hireDurationsDays: number[] }
  >();
  for (const dept of departments) {
    byDept.set(dept, { department: dept, totalVacancies: 0, closedVacancies: 0, openVacancies: 0, overdueVacancies: 0, hired: 0, rejected: 0, hireDurationsDays: [] });
  }
  for (const v of vacancies) {
    const entry = byDept.get(v.department)!;
    entry.totalVacancies++;
    if (v.status === "CLOSED") entry.closedVacancies++;
    if (v.status === "OPEN") entry.openVacancies++;
    if (fillTimelineStatusServer(v) === "OVERDUE") entry.overdueVacancies++;
  }
  for (const app of hiredApps) {
    const entry = byDept.get(app.vacancy.department);
    if (!entry) continue;
    entry.hired++;
    if (app.decidedAt) entry.hireDurationsDays.push((app.decidedAt.getTime() - app.appliedAt.getTime()) / (1000 * 60 * 60 * 24));
  }
  for (const app of rejectedApps) {
    const entry = byDept.get(app.vacancy.department);
    if (entry) entry.rejected++;
  }

  const rows = [...byDept.values()].map((d) => ({
    department: d.department,
    fillRate: d.totalVacancies > 0 ? Number(((d.closedVacancies / d.totalVacancies) * 100).toFixed(0)) : 0,
    avgTimeToHireDays: d.hireDurationsDays.length > 0 ? Number((d.hireDurationsDays.reduce((a, b) => a + b, 0) / d.hireDurationsDays.length).toFixed(1)) : null,
    openRoles: d.openVacancies,
    overdueRoles: d.overdueVacancies,
    hired: d.hired,
    rejected: d.rejected,
  }));

  const bestFillRate = rows.length > 0 ? [...rows].sort((a, b) => b.fillRate - a.fillRate)[0]! : null;
  const withHires = rows.filter((r) => r.avgTimeToHireDays !== null);
  const fastestHiring = withHires.length > 0 ? [...withHires].sort((a, b) => a.avgTimeToHireDays! - b.avgTimeToHireDays!)[0]! : null;
  const mostOpenRoles = rows.length > 0 ? [...rows].sort((a, b) => b.openRoles - a.openRoles)[0]! : null;
  const totalOverdueRoles = rows.reduce((sum, r) => sum + r.overdueRoles, 0);

  return {
    summary: {
      bestFillRate: bestFillRate ? { department: bestFillRate.department, value: bestFillRate.fillRate } : null,
      fastestHiring: fastestHiring ? { department: fastestHiring.department, days: fastestHiring.avgTimeToHireDays! } : null,
      mostOpenRoles: mostOpenRoles ? { department: mostOpenRoles.department, count: mostOpenRoles.openRoles } : null,
      overdueRoles: totalOverdueRoles,
    },
    hiredByDepartment: [...rows].sort((a, b) => b.hired - a.hired).map((r) => ({ department: r.department, count: r.hired })),
    rejectedByDepartment: [...rows].sort((a, b) => b.rejected - a.rejected).map((r) => ({ department: r.department, count: r.rejected })),
    rows,
  };
}

export async function getDepartmentPerformance(req: Request, res: Response) {
  const { dateRange, department, vacancyId } = req.query as { dateRange?: DateRangeFilter; department?: string; vacancyId?: string };
  try {
    const data = await buildDepartmentPerformanceData({ dateRange, department, vacancyId: vacancyId ? Number(vacancyId) : undefined });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build department performance" });
  }
}

// ---------------------------------------------------------------------------
// 4. Hiring Trends
// ---------------------------------------------------------------------------

const TREND_MONTHS = 8;

async function buildHiringTrendsData(filters: ScopeFilters) {
  const vacancies = await getScopedVacancies(filters);
  const vacancyIds = vacancies.map((v) => v.id);
  const allApplications = vacancies.flatMap((v) => v.applications);

  const [candidatesInRounds, hiredApps] = await Promise.all([
    prisma.candidateApplication.count({ where: { vacancyId: { in: vacancyIds }, stage: "SHORTLISTED", currentVacancyStageId: { not: null } } }),
    prisma.candidateApplication.findMany({ where: { vacancyId: { in: vacancyIds }, stage: "HIRED", decidedAt: { not: null } }, select: { decidedAt: true } }),
  ]);

  const now = new Date();
  const months: { key: string; label: string; count: number }[] = [];
  for (let i = TREND_MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en-GB", { month: "short" }), count: 0 });
  }
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));
  for (const app of hiredApps) {
    const d = app.decidedAt!;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const idx = monthIndex.get(key);
    if (idx !== undefined) months[idx]!.count++;
  }

  return {
    applications: allApplications.length,
    candidatesInRounds,
    hired: allApplications.filter((a) => a.stage === "HIRED").length,
    rejected: allApplications.filter((a) => a.stage === "REJECTED").length,
    trend: months.map((m) => ({ label: m.label, count: m.count })),
  };
}

export async function getHiringTrends(req: Request, res: Response) {
  const { dateRange, department, vacancyId } = req.query as { dateRange?: DateRangeFilter; department?: string; vacancyId?: string };
  try {
    const data = await buildHiringTrendsData({ dateRange, department, vacancyId: vacancyId ? Number(vacancyId) : undefined });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build hiring trends" });
  }
}

// ---------------------------------------------------------------------------
// 5. Export Reports (on-demand PDFs, confirmed via AskUserQuestion -- same
// pattern as Management's Reports page rather than the doc's conflicting
// "scheduled reports" draft)
// ---------------------------------------------------------------------------

export const REPORT_TYPES = ["recruitment-performance", "department-performance", "round-performance", "vacancy-status"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_METADATA: Record<ReportType, { name: string }> = {
  "recruitment-performance": { name: "Recruitment Performance Report" },
  "department-performance": { name: "Department Performance Report" },
  "round-performance": { name: "Round Performance Report" },
  "vacancy-status": { name: "Vacancy Status Report" },
};

export async function listReports(_req: Request, res: Response) {
  res.json({ reports: REPORT_TYPES.map((type) => ({ type, name: REPORT_METADATA[type].name })) });
}

async function buildRoundPerformanceData(filters: ScopeFilters) {
  const vacancies = await getScopedVacancies(filters);
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
  const type = req.params.type as ReportType;
  if (!REPORT_TYPES.includes(type)) {
    return res.status(400).json({ error: "Unknown report type" });
  }

  // Same fix as management.controller.ts's getReportPdf: fetch all data
  // BEFORE sending PDF headers / starting the doc.pipe(res) stream, so a
  // data-fetch error can still return a clean JSON 500 instead of
  // corrupting an already-started PDF download.
  let reportData: {
    dashboard?: Awaited<ReturnType<typeof buildDashboardData>>;
    departmentPerformance?: Awaited<ReturnType<typeof buildDepartmentPerformanceData>>;
    roundPerformance?: Awaited<ReturnType<typeof buildRoundPerformanceData>>;
    agedVacancies?: Awaited<ReturnType<typeof getScopedVacancies>>;
  };
  try {
    if (type === "recruitment-performance") {
      reportData = { dashboard: await buildDashboardData({}) };
    } else if (type === "department-performance") {
      reportData = { departmentPerformance: await buildDepartmentPerformanceData({}) };
    } else if (type === "round-performance") {
      reportData = { roundPerformance: await buildRoundPerformanceData({}) };
    } else {
      reportData = { agedVacancies: await getScopedVacancies({}) };
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not build report PDF" });
  }

  try {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${type}-report.pdf"`);

    const doc = new PDFDocument({ margin: PDF_MARGIN, size: "A4" });
    doc.pipe(res);

    let y = drawReportHeader(doc, "LEADERSHIP REPORT");
    y = drawReportTitleBlock(doc, REPORT_METADATA[type].name, `Org-wide   |   Generated ${new Date().toLocaleDateString("en-GB")}`, y);

    if (type === "recruitment-performance") {
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
      drawReportTable(
        doc,
        PDF_MARGIN,
        y,
        [170, 170],
        [["Stage", "Candidates"], ...data.anchors.map((a) => [a.label, String(a.candidateCount)]), ...data.rounds.map((r) => [r.label, String(r.candidateCount)])]
      );
    } else if (type === "department-performance") {
      const data = await buildDepartmentPerformanceData({});
      y = drawReportSectionHeading(doc, "Summary", y);
      y =
        drawReportTable(
          doc,
          PDF_MARGIN,
          y,
          [170, 170],
          [
            ["Metric", "Value"],
            ["Best Fill Rate", data.summary.bestFillRate ? `${data.summary.bestFillRate.department} (${data.summary.bestFillRate.value}%)` : "N/A"],
            ["Fastest Hiring", data.summary.fastestHiring ? `${data.summary.fastestHiring.department} (${data.summary.fastestHiring.days}d)` : "N/A"],
            ["Most Open Roles", data.summary.mostOpenRoles ? `${data.summary.mostOpenRoles.department} (${data.summary.mostOpenRoles.count})` : "N/A"],
            ["Overdue Roles", String(data.summary.overdueRoles)],
          ]
        ) + 20;

      y = ensureSpace(doc, y);
      y = drawReportSectionHeading(doc, "By Department", y);
      drawReportTable(
        doc,
        PDF_MARGIN,
        y,
        [130, 90, 90, 80, 60, 60],
        [
          ["Department", "Fill Rate", "Avg. Days", "Open", "Hired", "Rejected"],
          ...data.rows.map((r) => [r.department, `${r.fillRate}%`, r.avgTimeToHireDays !== null ? String(r.avgTimeToHireDays) : "N/A", String(r.openRoles), String(r.hired), String(r.rejected)]),
        ]
      );
    } else if (type === "round-performance") {
      const rounds = await buildRoundPerformanceData({});
      y = drawReportSectionHeading(doc, "Round Performance", y);
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
      const vacancies = await getScopedVacancies({});
      const aged = [...vacancies].sort((a, b) => daysOpenOf(b) - daysOpenOf(a));
      y = drawReportSectionHeading(doc, "Vacancy Status (oldest first)", y);
      drawReportTable(
        doc,
        PDF_MARGIN,
        y,
        [160, 90, 80, 80, 80],
        [
          ["Vacancy", "Department", "Days Open", "Status", "Candidates"],
          ...aged.map((v) => [v.title, v.department, String(daysOpenOf(v)), STATUS_LABEL[fillTimelineStatusServer(v)], String(v.applications.length)]),
        ]
      );
    }

    drawReportFooter(doc, doc.y + 20);
    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build report PDF" });
  }
}
