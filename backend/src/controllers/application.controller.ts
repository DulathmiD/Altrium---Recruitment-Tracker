import type { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { sendEmail } from "../utils/mailer.js";
import { initializeApplicationStage, transitionApplicationStage, STAGE_RANK, STAGE_LABELS } from "../utils/stageTransition.js";

export async function applyCandidateToVacancy(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  const { candidateId } = req.body as { candidateId?: number };
  if (!candidateId) {
    return res.status(400).json({ error: "candidateId is required" });
  }

  try {
    const application = await prisma.candidateApplication.create({
      data: { candidateId, vacancyId },
    });
    await initializeApplicationStage(application.id, req.user!.id);
    res.status(201).json(application);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "This candidate has already applied to this vacancy" });
    }
    if (err.code === "P2003") {
      return res.status(404).json({ error: "Candidate or vacancy not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not create application" });
  }
}

export async function listApplicationsForVacancy(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  try {
    const applications = await prisma.candidateApplication.findMany({
      where: { vacancyId },
      include: { candidate: true },
      orderBy: { appliedAt: "desc" },
    });
    res.json(applications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list applications" });
  }
}

export async function getApplication(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  try {
    const application = await prisma.candidateApplication.findUnique({
      where: { id },
      include: {
        candidate: true,
        vacancy: true,
        decidedBy: true,
        hiringManager: true,
        stageHistory: { orderBy: { enteredAt: "asc" } },
        recommendations: { include: { hiringManager: true }, orderBy: { createdAt: "desc" } },
      },
    });

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    res.json(application);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch application" });
  }
}

const VALID_DECISIONS = ["HIRE", "REJECT"] as const;
type HiringDecisionValue = (typeof VALID_DECISIONS)[number];

export async function recordHiringDecision(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  const { hiringDecision } = req.body as { hiringDecision?: HiringDecisionValue };
  if (!hiringDecision || !VALID_DECISIONS.includes(hiringDecision)) {
    return res.status(400).json({ error: "hiringDecision must be HIRE or REJECT" });
  }

  try {
    const existing = await prisma.candidateApplication.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Application not found" });
    }

    if (existing.stage === "HIRED" || existing.stage === "REJECTED") {
      return res.status(400).json({ error: "This application has already reached a final outcome" });
    }

    // Hiring can only be confirmed once a candidate has completed the full
    // interview pipeline -- consistent with the no-skip rule enforced in
    // updateApplicationStage (US-31). Rejection has no such restriction: it's
    // a valid outcome from any stage (US-05/US-31).
    if (hiringDecision === "HIRE" && existing.stage !== "FINAL_INTERVIEW") {
      return res.status(400).json({
        error: `Cannot hire from ${STAGE_LABELS[existing.stage as keyof typeof STAGE_LABELS]} -- candidate must reach Final Interview first`,
      });
    }

    const application = await transitionApplicationStage(
      id,
      hiringDecision === "HIRE" ? "HIRED" : "REJECTED",
      req.user!.id,
      { hiringDecision, decidedByUserId: req.user!.id, decidedAt: new Date() }
    );

    // Email failure must not block the decision itself -- log and move on.
    try {
      const { candidate, vacancy } = application as any;
      if (hiringDecision === "HIRE") {
        await sendEmail({
          to: candidate.email,
          subject: `Congratulations - offer for ${vacancy.title} at Altrium`,
          body: `Hi ${candidate.name},\n\nWe're pleased to let you know you've been selected for the ${vacancy.title} role at Altrium. Our HR team will be in touch shortly with next steps and offer details.\n\nCongratulations!`,
        });
      } else {
        await sendEmail({
          to: candidate.email,
          subject: `Update on your application for ${vacancy.title} at Altrium`,
          body: `Hi ${candidate.name},\n\nThank you for taking the time to interview for the ${vacancy.title} role at Altrium. After careful consideration, we've decided to move forward with another candidate.\n\nWe appreciate your interest in Altrium and encourage you to apply for future openings that match your experience.`,
        });
      }
    } catch (emailErr) {
      console.error("Hiring decision recorded but notification email failed:", emailErr);
    }

    res.json(application);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not record hiring decision" });
  }
}

export async function compareApplicationsForVacancy(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  try {
    const applications = await prisma.candidateApplication.findMany({
      where: {
        vacancyId,
        stage: { in: ["SHORTLISTED", "INTERVIEW_1", "INTERVIEW_2", "FINAL_INTERVIEW"] },
      },
      include: {
        candidate: true,
        decidedBy: true,
        interviews: {
          include: {
            feedback: { include: { interviewer: true } },
          },
        },
      },
      orderBy: { appliedAt: "asc" },
    });
    res.json(applications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build comparison" });
  }
}

// Interviewer-only forward progression through the interview stages
// (INTERVIEW_1 -> INTERVIEW_2 -> FINAL_INTERVIEW). Exactly one rank forward at
// a time -- no skipping, no moving backwards (US-31). APPLIED/SHORTLISTED are
// HR's job (updateApplicationStatus) and HIRED/REJECTED are the Hiring
// Manager's job (recordHiringDecision) -- this endpoint only accepts the three
// interview-progression stages.
const PROGRESSABLE_STAGES = ["INTERVIEW_1", "INTERVIEW_2", "FINAL_INTERVIEW"] as const;

export async function updateApplicationStage(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  const { stage } = req.body as { stage?: string };
  if (!stage || !PROGRESSABLE_STAGES.includes(stage as (typeof PROGRESSABLE_STAGES)[number])) {
    return res.status(400).json({ error: `stage must be one of: ${PROGRESSABLE_STAGES.join(", ")}` });
  }

  try {
    const application = await prisma.candidateApplication.findUnique({ where: { id } });
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    if (application.stage === "REJECTED" || application.stage === "HIRED") {
      return res.status(400).json({ error: "Cannot progress an application that has already reached a final outcome" });
    }

    const currentRank = STAGE_RANK[application.stage as keyof typeof STAGE_RANK];
    const targetRank = STAGE_RANK[stage as keyof typeof STAGE_RANK];

    if (targetRank !== currentRank + 1) {
      return res.status(400).json({
        error: `Cannot move from ${STAGE_LABELS[application.stage]} to ${STAGE_LABELS[stage as keyof typeof STAGE_LABELS]} -- stages must advance one at a time, no skipping or moving backwards`,
      });
    }

    const updated = await transitionApplicationStage(id, stage as any, req.user!.id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update application stage" });
  }
}

// US-19: Hiring Manager's advisory recommendation. Deliberately does NOT touch
// CandidateApplication.stage -- this is separate advisory input, distinct from
// the Interviewer's actual stage update above.
const VALID_RECOMMENDATIONS = ["ADVANCE", "DO_NOT_PROGRESS"] as const;

export async function submitStageRecommendation(req: Request, res: Response) {
  const applicationId = Number(req.params.id);
  if (Number.isNaN(applicationId)) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  const { recommendation, comments } = req.body as { recommendation?: string; comments?: string };
  if (!recommendation || !VALID_RECOMMENDATIONS.includes(recommendation as (typeof VALID_RECOMMENDATIONS)[number])) {
    return res.status(400).json({ error: "recommendation must be ADVANCE or DO_NOT_PROGRESS" });
  }

  try {
    const application = await prisma.candidateApplication.findUnique({ where: { id: applicationId } });
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    const created = await prisma.stageRecommendation.create({
      data: {
        applicationId,
        hiringManagerId: req.user!.id,
        recommendation: recommendation as any,
        comments,
      },
      include: { hiringManager: true },
    });
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not submit recommendation" });
  }
}

export async function listRecommendationsForApplication(req: Request, res: Response) {
  const applicationId = Number(req.params.id);
  if (Number.isNaN(applicationId)) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  try {
    const recommendations = await prisma.stageRecommendation.findMany({
      where: { applicationId },
      include: { hiringManager: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(recommendations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list recommendations" });
  }
}

export async function assignHiringManager(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  const { hiringManagerId } = req.body as { hiringManagerId?: number };
  if (!hiringManagerId) {
    return res.status(400).json({ error: "hiringManagerId is required" });
  }

  try {
    const application = await prisma.candidateApplication.findUnique({ where: { id } });
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: hiringManagerId } });
    if (!targetUser || targetUser.role !== "HIRING_MANAGER") {
      return res.status(400).json({ error: "hiringManagerId must belong to a user with the HIRING_MANAGER role" });
    }

    const updated = await prisma.candidateApplication.update({
      where: { id },
      data: { hiringManagerId },
      include: { candidate: true, vacancy: true, hiringManager: true },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not assign hiring manager" });
  }
}

export async function listApplicationsAssignedToMe(req: Request, res: Response) {
  const hiringManagerId = req.user!.id;

  try {
    const applications = await prisma.candidateApplication.findMany({
      where: { hiringManagerId },
      include: { candidate: true, vacancy: true },
      orderBy: { appliedAt: "desc" },
    });
    res.json(applications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list assigned applications" });
  }
}

// HR-only, CV-review-phase decision: shortlist or reject a fresh application.
// Everything past this point is handled by updateApplicationStage
// (interview progression) or recordHiringDecision (final outcome).
const VALID_STATUS_TARGETS = ["SHORTLISTED", "REJECTED"] as const;

export async function updateApplicationStatus(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  const { status } = req.body as { status?: string };

  if (!status || !VALID_STATUS_TARGETS.includes(status as (typeof VALID_STATUS_TARGETS)[number])) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUS_TARGETS.join(", ")}` });
  }

  try {
    const existing = await prisma.candidateApplication.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Application not found" });
    }
    if (existing.stage !== "APPLIED") {
      return res.status(400).json({ error: "Can only shortlist or reject an application that is still in the Applied stage" });
    }

    const updated = await transitionApplicationStage(id, status as any, req.user!.id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update application status" });
  }
}
