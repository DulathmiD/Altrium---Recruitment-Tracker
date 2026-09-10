import type { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { notifyUser } from "../utils/notify.js";

// Hiring Managers don't sit on interview panels in this system's actual
// design -- their role is deciding Proceed/Do Not Proceed/Hire/Reject from
// Pending Decisions based on OTHER people's interview feedback, not
// attending interviews themselves (see project-decisions-log.md, 23rd pass
// -- an HM "My Interviews" page was built, then removed, for exactly this
// reason). Same eligible-role set as assignInterviewerToVacancy
// (vacancy.controller.ts) -- kept as a literal array here rather than
// importing, since that controller doesn't currently export it as a shared
// constant.
const PANEL_ELIGIBLE_ROLES = ["INTERVIEWER", "MANAGEMENT"];

// Named, reusable subset of a vacancy's interviewer pool (e.g. "Panel 1",
// "Panel 2"). Members are NOT blocked from being on more than one panel for
// the same vacancy -- reuse across panels is intentional (see schema.prisma
// comment on InterviewPanel).
export async function createInterviewPanel(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  const { name, userIds } = req.body as { name?: string; userIds?: number[] };
  const trimmedName = (name ?? "").trim();
  if (!trimmedName) {
    return res.status(400).json({ error: "Panel name is required" });
  }
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: "Select at least one staff member" });
  }

  try {
    const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
    if (users.length !== userIds.length) {
      return res.status(400).json({ error: "One or more selected staff members were not found" });
    }
    const ineligible = users.find((u) => !PANEL_ELIGIBLE_ROLES.includes(u.role));
    if (ineligible) {
      return res.status(400).json({
        error: `${ineligible.name} cannot be added to an interview panel -- must be an Interviewer or Management user`,
      });
    }

    const panel = await prisma.$transaction(async (tx) => {
      const created = await tx.interviewPanel.create({
        data: {
          vacancyId,
          name: trimmedName,
          members: { create: userIds.map((userId) => ({ userId })) },
        },
        include: { members: { include: { user: true } } },
      });

      // Keep the vacancy's overall interviewer pool in sync -- scheduling
      // still validates panelists against VacancyInterviewer
      // (validatePanelistsAndConflict in interview.controller.ts), and other
      // screens (e.g. CandidateDetailPage's quick single-candidate schedule
      // flow) still read that whole-pool list. Upsert so re-adding someone
      // already in the pool via a second panel is a no-op, not an error.
      for (const userId of userIds) {
        await tx.vacancyInterviewer.upsert({
          where: { vacancyId_userId: { vacancyId, userId } },
          update: {},
          create: { vacancyId, userId },
        });
      }

      return created;
    });

    // Notify everyone just placed on this panel -- previously silent, same
    // gap as assignInterviewerToVacancy (vacancy.controller.ts) had. One
    // extra lookup for the vacancy title rather than folding it into the
    // transaction's include, since a notification failure must never roll
    // back the panel itself (best-effort, same contract as every other
    // notifyUser() call site).
    const vacancy = await prisma.vacancy.findUnique({ where: { id: vacancyId }, select: { title: true } });
    for (const member of panel.members) {
      await notifyUser(
        member.userId,
        "interview_panel_assigned",
        `You've been added to "${panel.name}" for ${vacancy?.title ?? "a vacancy"}.`
      );
    }

    res.status(201).json(panel);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "A panel with this name already exists for this vacancy" });
    }
    if (err?.code === "P2003") {
      return res.status(404).json({ error: "Vacancy not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not create panel" });
  }
}

export async function listInterviewPanelsForVacancy(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  try {
    const panels = await prisma.interviewPanel.findMany({
      where: { vacancyId },
      include: { members: { include: { user: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json(panels);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list panels" });
  }
}
