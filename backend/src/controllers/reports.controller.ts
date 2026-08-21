import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { prisma } from "../prisma.js";
import { STAGE_LABELS } from "../utils/stageTransition.js";

const ALL_STAGES = ["APPLIED", "SHORTLISTED", "INTERVIEW_1", "INTERVIEW_2", "FINAL_INTERVIEW", "HIRED", "REJECTED"] as const;

function emptyStageCounts(): Record<string, number> {
  return Object.fromEntries(ALL_STAGES.map((s) => [s, 0]));
}

// Averages exitedAt-enteredAt (in hours) per stage across a set of stage-history
// rows. Entries still open (exitedAt: null, i.e. the candidate's current stage)
// are excluded -- there's no "time in stage" to report until they've left it.
function computeStageTimings(historyRows: { stage: string; enteredAt: Date; exitedAt: Date | null }[]) {
  const byStage: Record<string, number[]> = {};
  for (const row of historyRows) {
    if (!row.exitedAt) continue;
    const hours = (row.exitedAt.getTime() - row.enteredAt.getTime()) / (1000 * 60 * 60);
    (byStage[row.stage] ??= []).push(hours);
  }
  return ALL_STAGES.map((stage) => {
    const durations = byStage[stage] ?? [];
    const avgHours = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
    return {
      stage,
      label: STAGE_LABELS[stage as keyof typeof STAGE_LABELS],
      completedCount: durations.length,
      averageHoursInStage: avgHours !== null ? Number(avgHours.toFixed(1)) : null,
    };
  });
}

// 5.1 — Management dashboard: active vacancies + their recruitment progress
export async function getDashboard(req: Request, res: Response) {
  try {
    const vacancies = await prisma.vacancy.findMany({
      where: { status: { in: ["OPEN", "ON_HOLD"] } },
      include: {
        applications: { select: { stage: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const dashboard = vacancies.map((v) => {
      const stageCounts = emptyStageCounts();
      for (const app of v.applications) {
        stageCounts[app.stage] = (stageCounts[app.stage] ?? 0) + 1;
      }
      return {
        id: v.id,
        title: v.title,
        department: v.department,
        status: v.status,
        totalApplications: v.applications.length,
        stageCounts,
      };
    });

    res.json(dashboard);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build dashboard" });
  }
}

// 5.2 — Monitor the number of candidates in each recruitment stage.
// Stages are now a fixed global set (not per-vacancy), so this counts
// applications grouped by their current `stage`, optionally scoped to one vacancy.
export async function getStageMonitoring(req: Request, res: Response) {
  const { vacancyId } = req.query as { vacancyId?: string };
  const where = vacancyId ? { vacancyId: Number(vacancyId) } : {};

  try {
    const counts = await prisma.candidateApplication.groupBy({
      by: ["stage"],
      where,
      _count: { _all: true },
    });

    const countsByStage = Object.fromEntries(counts.map((c) => [c.stage, c._count._all]));

    res.json({
      stages: ALL_STAGES.map((stage) => ({
        stage,
        label: STAGE_LABELS[stage as keyof typeof STAGE_LABELS],
        candidateCount: countsByStage[stage] ?? 0,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build stage monitoring report" });
  }
}

// 5.3 — Recruitment KPIs
export async function getKpis(req: Request, res: Response) {
  const { vacancyId } = req.query as { vacancyId?: string };
  const where = vacancyId ? { vacancyId: Number(vacancyId) } : {};

  try {
    const [
      applicationsReceived,
      shortlisted,
      hiredApplications,
      rejected,
      interviewsScheduled,
      interviewsCompleted,
      openVacancies,
    ] = await Promise.all([
      prisma.candidateApplication.count({ where }),
      prisma.candidateApplication.count({ where: { ...where, stage: "SHORTLISTED" } }),
      prisma.candidateApplication.findMany({
        where: { ...where, stage: "HIRED" },
        select: { appliedAt: true, decidedAt: true },
      }),
      prisma.candidateApplication.count({ where: { ...where, stage: "REJECTED" } }),
      prisma.interview.count({ where: { application: where } }),
      prisma.interview.count({ where: { application: where, feedback: { some: {} } } }),
      vacancyId
        ? prisma.vacancy.count({ where: { id: Number(vacancyId), status: "OPEN" } })
        : prisma.vacancy.count({ where: { status: "OPEN" } }),
    ]);

    // US-32: average time to hire, in days, across HIRED applications in scope.
    const hireDurationsDays = hiredApplications
      .filter((a) => a.decidedAt)
      .map((a) => (a.decidedAt!.getTime() - a.appliedAt.getTime()) / (1000 * 60 * 60 * 24));
    const averageTimeToHireDays =
      hireDurationsDays.length > 0
        ? Number((hireDurationsDays.reduce((a, b) => a + b, 0) / hireDurationsDays.length).toFixed(1))
        : null;

    res.json({
      applicationsReceived,
      shortlisted,
      interviewsScheduled,
      interviewsCompleted,
      hires: hiredApplications.length,
      rejected,
      openVacancies,
      averageTimeToHireDays,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build KPI report" });
  }
}

async function buildVacancyReportData(vacancyId: number) {
  const vacancy = await prisma.vacancy.findUnique({
    where: { id: vacancyId },
    include: {
      applications: {
        include: {
          candidate: true,
          interviews: { include: { feedback: true } },
          stageHistory: true,
        },
      },
    },
  });

  if (!vacancy) return null;

  const stageCounts = emptyStageCounts();
  let totalScore = 0;
  let scoreCount = 0;
  let interviewCount = 0;
  const allHistoryRows: { stage: string; enteredAt: Date; exitedAt: Date | null }[] = [];

  for (const app of vacancy.applications) {
    stageCounts[app.stage] = (stageCounts[app.stage] ?? 0) + 1;
    allHistoryRows.push(...app.stageHistory);
    for (const interview of app.interviews) {
      interviewCount++;
      for (const fb of interview.feedback) {
        totalScore += fb.score;
        scoreCount++;
      }
    }
  }

  return {
    vacancy,
    stageCounts,
    interviewCount,
    averageFeedbackScore: scoreCount > 0 ? Number((totalScore / scoreCount).toFixed(2)) : null,
    stageTimings: computeStageTimings(allHistoryRows),
  };
}

// 5.4 — Recruitment report for a single vacancy. Available for both open and
// closed vacancies (no closed-only gate, per explicit decision overriding the
// literal US-37 wording).
export async function getVacancyReport(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  try {
    const data = await buildVacancyReportData(vacancyId);
    if (!data) {
      return res.status(404).json({ error: "Vacancy not found" });
    }
    const { vacancy, stageCounts, interviewCount, averageFeedbackScore, stageTimings } = data;

    res.json({
      vacancyId: vacancy.id,
      title: vacancy.title,
      department: vacancy.department,
      status: vacancy.status,
      createdAt: vacancy.createdAt,
      totalApplications: vacancy.applications.length,
      stageCounts,
      totalInterviews: interviewCount,
      averageFeedbackScore,
      stageTimings,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build vacancy report" });
  }
}

// 5.5 — PDF export of the per-vacancy recruitment report (same data as 5.4, rendered as a document)
export async function getVacancyReportPdf(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  try {
    const data = await buildVacancyReportData(vacancyId);
    if (!data) {
      return res.status(404).json({ error: "Vacancy not found" });
    }
    const { vacancy, stageCounts, interviewCount, averageFeedbackScore, stageTimings } = data;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="vacancy-${vacancy.id}-report.pdf"`);

    const GOLD = "#f5a623";
    const BLACK = "#000000";
    const GRAY = "#555555";
    const LIGHT = "#f2f2f2";
    const PAGE_WIDTH = 612;
    const MARGIN = 50;
    const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

    const doc = new PDFDocument({ margin: MARGIN, size: "A4" });
    doc.pipe(res);

    // ---- Header band: black bar with the Altrium wordmark + a simplified hexagon mark ----
    const HEADER_HEIGHT = 90;
    doc.rect(0, 0, doc.page.width, HEADER_HEIGHT).fill(BLACK);
    doc.fillColor("#ffffff").fontSize(24).font("Helvetica-Bold").text("ALTRIUM", MARGIN, 26);
    doc
      .fillColor(GOLD)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("RECRUITMENT REPORT", MARGIN, 56, { characterSpacing: 1.5 });

    const hexCx = doc.page.width - MARGIN - 25;
    const hexCy = HEADER_HEIGHT / 2;
    const hexR = 22;
    const hexPoints: [number, number][] = [0, 1, 2, 3, 4, 5].map((i) => {
      const angle = (Math.PI / 180) * (60 * i - 30);
      return [hexCx + hexR * Math.cos(angle), hexCy + hexR * Math.sin(angle)];
    });
    doc.polygon(...hexPoints).fillAndStroke(BLACK, GOLD);
    doc.polygon([hexCx - 6, hexCy - 8], [hexCx - 6, hexCy + 8], [hexCx + 9, hexCy]).fill("#ffffff");
    doc.circle(hexCx + hexR * 0.7, hexCy + hexR * 0.55, 4).fill(GOLD);

    doc.fillColor(BLACK).font("Helvetica");

    // ---- Vacancy title block ----
    let y = HEADER_HEIGHT + 25;
    doc.fontSize(17).font("Helvetica-Bold").fillColor(BLACK).text(vacancy.title, MARGIN, y);
    y = doc.y + 4;
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor(GRAY)
      .text(`${vacancy.department}   |   Status: ${vacancy.status}   |   Created: ${vacancy.createdAt.toDateString()}`, MARGIN, y);
    y = doc.y + 12;
    doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_WIDTH, y).lineWidth(2).strokeColor(GOLD).stroke();
    y += 22;

    function sectionHeading(title: string, atY: number): number {
      doc.rect(MARGIN, atY, 4, 14).fill(GOLD);
      doc.fontSize(12).font("Helvetica-Bold").fillColor(BLACK).text(title, MARGIN + 12, atY - 1);
      return doc.y + 8;
    }

    function drawTable(startX: number, startY: number, colWidths: number[], rows: string[][]): number {
      const rowHeight = 20;
      let rowY = startY;
      rows.forEach((row, rowIndex) => {
        const isHeader = rowIndex === 0;
        let rowX = startX;
        row.forEach((cell, colIndex) => {
          const w = colWidths[colIndex];
          const bg = isHeader ? GOLD : rowIndex % 2 === 0 ? LIGHT : "#ffffff";
          doc.rect(rowX, rowY, w, rowHeight).fillAndStroke(bg, "#dddddd");
          doc
            .fillColor(isHeader ? BLACK : "#222222")
            .font(isHeader ? "Helvetica-Bold" : "Helvetica")
            .fontSize(9)
            .text(cell, rowX + 8, rowY + 6, { width: w - 16 });
          rowX += w;
        });
        rowY += rowHeight;
      });
      return rowY;
    }

    // ---- Application Summary (as a table) ----
    y = sectionHeading("Application Summary", y);
    doc.fontSize(10).font("Helvetica").fillColor(BLACK).text(`Total applications: ${vacancy.applications.length}`, MARGIN, y);
    y = doc.y + 10;
    const stageRows = [
      ["Stage", "Count"],
      ...ALL_STAGES.map((s) => [STAGE_LABELS[s as keyof typeof STAGE_LABELS], String(stageCounts[s])]),
    ];
    y = drawTable(MARGIN, y, [220, 100], stageRows) + 20;

    // ---- Stage Progression / Time-in-Stage ----
    if (y > 620) {
      doc.addPage();
      y = 50;
    }
    y = sectionHeading("Stage Progression (avg. time in stage)", y);
    const timingRows = [
      ["Stage", "Completed", "Avg. Hours"],
      ...stageTimings.map((t) => [t.label, String(t.completedCount), t.averageHoursInStage !== null ? String(t.averageHoursInStage) : "N/A"]),
    ];
    y = drawTable(MARGIN, y, [220, 100, 100], timingRows) + 20;

    // ---- Interview & Feedback Summary ----
    if (y > 650) {
      doc.addPage();
      y = 50;
    }
    y = sectionHeading("Interview & Feedback Summary", y);
    doc.fontSize(10).font("Helvetica").fillColor(BLACK).text(`Total interviews held: ${interviewCount}`, MARGIN, y);
    y = doc.y + 4;
    doc.text(
      `Average feedback score: ${averageFeedbackScore !== null ? averageFeedbackScore : "N/A (no feedback submitted yet)"}`,
      MARGIN,
      y
    );
    y = doc.y + 20;

    // ---- Footer ----
    doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_WIDTH, y).lineWidth(1).strokeColor(GOLD).stroke();
    y += 8;
    doc.fontSize(8).fillColor(GRAY).font("Helvetica").text("Altrium Recruitment & Hiring Tracker", MARGIN, y);
    doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, MARGIN, y, { width: CONTENT_WIDTH, align: "right" });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build vacancy report PDF" });
  }
}
