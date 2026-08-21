import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { prisma } from "../prisma.js";

// 5.1 — Management dashboard: active vacancies + their recruitment progress
export async function getDashboard(req: Request, res: Response) {
  try {
    const vacancies = await prisma.vacancy.findMany({
      where: { status: { in: ["OPEN", "ON_HOLD"] } },
      include: {
        applications: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const dashboard = vacancies.map((v) => {
      const statusCounts: Record<string, number> = {
        APPLIED: 0,
        SHORTLISTED: 0,
        IN_PROGRESS: 0,
        HIRED: 0,
        REJECTED: 0,
      };
      for (const app of v.applications) {
        statusCounts[app.status] = (statusCounts[app.status] ?? 0) + 1;
      }
      return {
        id: v.id,
        title: v.title,
        department: v.department,
        status: v.status,
        totalApplications: v.applications.length,
        statusCounts,
      };
    });

    res.json(dashboard);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build dashboard" });
  }
}

// 5.2 — Monitor the number of candidates in each recruitment stage
export async function getStageMonitoring(req: Request, res: Response) {
  const { vacancyId } = req.query as { vacancyId?: string };

  try {
    const stages = await prisma.vacancyStage.findMany({
      where: vacancyId ? { vacancyId: Number(vacancyId) } : undefined,
      include: {
        _count: { select: { applicationsAtStage: true } },
      },
      orderBy: [{ vacancyId: "asc" }, { order: "asc" }],
    });

    const noStageCount = await prisma.candidateApplication.count({
      where: {
        currentStageId: null,
        ...(vacancyId ? { vacancyId: Number(vacancyId) } : {}),
      },
    });

    res.json({
      stages: stages.map((s) => ({
        stageId: s.id,
        vacancyId: s.vacancyId,
        name: s.name,
        order: s.order,
        candidateCount: s._count.applicationsAtStage,
      })),
      noStageAssigned: noStageCount,
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
    const [applicationsReceived, shortlisted, hired, rejected, interviewsScheduled, interviewsCompleted] =
      await Promise.all([
        prisma.candidateApplication.count({ where }),
        prisma.candidateApplication.count({ where: { ...where, status: "SHORTLISTED" } }),
        prisma.candidateApplication.count({ where: { ...where, status: "HIRED" } }),
        prisma.candidateApplication.count({ where: { ...where, status: "REJECTED" } }),
        prisma.interview.count({ where: { application: where } }),
        prisma.interview.count({ where: { application: where, feedback: { some: {} } } }),
      ]);

    res.json({
      applicationsReceived,
      shortlisted,
      interviewsScheduled,
      interviewsCompleted,
      hires: hired,
      rejected,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build KPI report" });
  }
}

// 5.4 — Recruitment report for a single vacancy
export async function getVacancyReport(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  try {
    const vacancy = await prisma.vacancy.findUnique({
      where: { id: vacancyId },
      include: {
        stages: { orderBy: { order: "asc" } },
        applications: {
          include: {
            candidate: true,
            interviews: { include: { feedback: true } },
          },
        },
      },
    });

    if (!vacancy) {
      return res.status(404).json({ error: "Vacancy not found" });
    }

    const statusCounts: Record<string, number> = {
      APPLIED: 0,
      SHORTLISTED: 0,
      IN_PROGRESS: 0,
      HIRED: 0,
      REJECTED: 0,
    };
    let totalScore = 0;
    let scoreCount = 0;
    let interviewCount = 0;

    for (const app of vacancy.applications) {
      statusCounts[app.status] = (statusCounts[app.status] ?? 0) + 1;
      for (const interview of app.interviews) {
        interviewCount++;
        for (const fb of interview.feedback) {
          totalScore += fb.score;
          scoreCount++;
        }
      }
    }

    res.json({
      vacancyId: vacancy.id,
      title: vacancy.title,
      department: vacancy.department,
      status: vacancy.status,
      createdAt: vacancy.createdAt,
      stages: vacancy.stages.map((s) => ({ id: s.id, name: s.name, order: s.order })),
      totalApplications: vacancy.applications.length,
      statusCounts,
      totalInterviews: interviewCount,
      averageFeedbackScore: scoreCount > 0 ? Number((totalScore / scoreCount).toFixed(2)) : null,
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
    const vacancy = await prisma.vacancy.findUnique({
      where: { id: vacancyId },
      include: {
        stages: { orderBy: { order: "asc" } },
        applications: {
          include: { candidate: true, interviews: { include: { feedback: true } } },
        },
      },
    });

    if (!vacancy) {
      return res.status(404).json({ error: "Vacancy not found" });
    }

    const statusCounts: Record<string, number> = {
      APPLIED: 0,
      SHORTLISTED: 0,
      IN_PROGRESS: 0,
      HIRED: 0,
      REJECTED: 0,
    };
    let totalScore = 0;
    let scoreCount = 0;
    let interviewCount = 0;

    for (const app of vacancy.applications) {
      statusCounts[app.status] = (statusCounts[app.status] ?? 0) + 1;
      for (const interview of app.interviews) {
        interviewCount++;
        for (const fb of interview.feedback) {
          totalScore += fb.score;
          scoreCount++;
        }
      }
    }
    const averageFeedbackScore = scoreCount > 0 ? Number((totalScore / scoreCount).toFixed(2)) : null;

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

    // Simplified hexagon logo mark (flat-top hexagon, gold outline on black, white arrow, gold dot)
    const hexCx = doc.page.width - MARGIN - 25;
    const hexCy = HEADER_HEIGHT / 2;
    const hexR = 22;
    const hexPoints: [number, number][] = [0, 1, 2, 3, 4, 5].map((i) => {
      const angle = (Math.PI / 180) * (60 * i - 30);
      return [hexCx + hexR * Math.cos(angle), hexCy + hexR * Math.sin(angle)];
    });
    doc.polygon(...hexPoints).fillAndStroke(BLACK, GOLD);
    doc
      .polygon(
        [hexCx - 6, hexCy - 8],
        [hexCx - 6, hexCy + 8],
        [hexCx + 9, hexCy]
      )
      .fill("#ffffff");
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

    // ---- Section helper: gold accent bar + bold black heading ----
    function sectionHeading(title: string, atY: number): number {
      doc.rect(MARGIN, atY, 4, 14).fill(GOLD);
      doc.fontSize(12).font("Helvetica-Bold").fillColor(BLACK).text(title, MARGIN + 12, atY - 1);
      return doc.y + 8;
    }

    // ---- Table helper: header row (gold) + alternating body rows ----
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

    // ---- Pipeline Stages ----
    y = sectionHeading("Pipeline Stages", y);
    doc.fontSize(10).font("Helvetica").fillColor(BLACK);
    if (vacancy.stages.length === 0) {
      doc.text("No stages defined for this vacancy.", MARGIN, y);
      y = doc.y + 16;
    } else {
      for (const s of vacancy.stages) {
        doc.text(`${s.order}.  ${s.name}`, MARGIN, y);
        y = doc.y + 4;
      }
      y += 12;
    }

    // ---- Application Summary (as a table) ----
    y = sectionHeading("Application Summary", y);
    doc.fontSize(10).font("Helvetica").fillColor(BLACK).text(`Total applications: ${vacancy.applications.length}`, MARGIN, y);
    y = doc.y + 10;
    const statusRows = [["Status", "Count"], ...Object.entries(statusCounts).map(([s, c]) => [s, String(c)])];
    y = drawTable(MARGIN, y, [220, 100], statusRows) + 20;

    // ---- Interview & Feedback Summary ----
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
