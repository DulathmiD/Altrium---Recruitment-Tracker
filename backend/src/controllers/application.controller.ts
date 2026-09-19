import type { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { sendEmail } from "../utils/mailer.js";
import { initializeApplicationStage, transitionApplicationStage } from "../utils/stageTransition.js";
import { writeAuditLog } from "../utils/auditLog.js";
import { renderTemplate } from "../utils/notificationTemplates.js";

// ON_HOLD freeze: putting a vacancy ON_HOLD is meant to actually pause its
// pipeline (budget freeze, role re-scoped, etc.), not just hide it from the
// "open vacancies" KPI count. While frozen: no candidate/CV can be added to
// it (applyCandidateToVacancy), and no existing application on it can change
// stage (submitStageRecommendation), get a final hiring decision
// (recordHiringDecision), or get a Hiring Manager assigned
// (assignHiringManager). Reopening the vacancy (status back to OPEN) is the
// only way to resume -- there's no separate "unfreeze this one candidate"
// escape hatch, since that would defeat the point of freezing the vacancy.
async function assertVacancyNotOnHold(vacancyId: number): Promise<string | null> {
  const vacancy = await prisma.vacancy.findUnique({ where: { id: vacancyId }, select: { status: true } });
  if (vacancy?.status === "ON_HOLD") {
    return "This vacancy is on hold. Reopen it before adding or progressing candidates.";
  }
  return null;
}

export async function applyCandidateToVacancy(req: Request, res: Response) {
  const vacancyId = Number(req.params.id);
  if (Number.isNaN(vacancyId)) {
    return res.status(400).json({ error: "Invalid vacancy id" });
  }

  const { candidateId } = req.body as { candidateId?: number };
  if (!candidateId) {
    return res.status(400).json({ error: "candidateId is required" });
  }

  const onHoldError = await assertVacancyNotOnHold(vacancyId);
  if (onHoldError) {
    return res.status(400).json({ error: onHoldError });
  }

  try {
    const application = await prisma.candidateApplication.create({
      data: { candidateId, vacancyId },
    });
    await initializeApplicationStage(application.id, req.user!.id);
    res.status(201).json(application);
  } catch (err: any) {
    if (err.code === "P2002") {
      // Named so the frontend can link straight to the existing application
      // (e.g. from the CV-upload duplicate flow) instead of just naming the
      // conflict in text with nowhere to go.
      const existing = await prisma.candidateApplication.findUnique({
        where: { candidateId_vacancyId: { candidateId, vacancyId } },
      });
      return res.status(409).json({
        error: "This candidate has already applied to this vacancy",
        existingApplicationId: existing?.id ?? null,
      });
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
        currentVacancyStage: true,
        stageHistory: { orderBy: { enteredAt: "asc" }, include: { vacancyStage: true } },
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

  const { hiringDecision, comments } = req.body as { hiringDecision?: HiringDecisionValue; comments?: string };
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

    const onHoldError = await assertVacancyNotOnHold(existing.vacancyId);
    if (onHoldError) {
      return res.status(400).json({ error: onHoldError });
    }

    // Hiring can only be confirmed once a candidate has completed the
    // vacancy's full (HR-configured) interview round list -- consistent with
    // the no-skip rule enforced in submitStageRecommendation. Rejection has
    // no such restriction: it's a valid outcome from any point (US-31).
    if (hiringDecision === "HIRE") {
      if (existing.currentVacancyStageId === null) {
        return res.status(400).json({
          error: "Cannot hire - candidate has not entered any interview round yet",
        });
      }
      const lastRound = await prisma.vacancyStage.findFirst({
        where: { vacancyId: existing.vacancyId },
        orderBy: { order: "desc" },
      });
      if (!lastRound || existing.currentVacancyStageId !== lastRound.id) {
        return res.status(400).json({
          error: "Cannot hire - candidate must reach the final configured interview round first",
        });
      }
    }

    const application = await transitionApplicationStage(
      id,
      { stage: hiringDecision === "HIRE" ? "HIRED" : "REJECTED" },
      req.user!.id,
      { hiringDecision, decidedByUserId: req.user!.id, decidedAt: new Date() }
    );

    // HIRE/REJECT has no dedicated comments column (unlike StageRecommendation
    // below, which already had one) -- logged via the generic AuditLog rather
    // than a schema migration, same pattern as NOTIFICATION_SENT tracking.
    if (comments && comments.trim()) {
      await writeAuditLog(req.user!.id, "HM_DECISION_COMMENT", "CandidateApplication", id, {
        decision: hiringDecision,
        comments: comments.trim(),
      });
    }

    res.json(application);

    // Email failure must not block the decision itself -- log and move on.
    // Follow-up correction: this used to be awaited above, before res.json --
    // that made every Hire/Reject click wait on full mail delivery (the
    // reported "takes a moment to load"). Fired without awaiting now, so the
    // response returns as soon as the decision is recorded; the email still
    // sends, and failures are still caught and logged, just after the fact.
    (async () => {
      try {
        const { candidate, vacancy } = application as any;
        const templateKey = hiringDecision === "HIRE" ? "hiring_decision_hire" : "hiring_decision_reject";
        const { subject, body } = await renderTemplate(templateKey, {
          candidateName: candidate.name,
          vacancyTitle: vacancy.title,
        });
        await sendEmail({ to: candidate.email, subject, body });
        await writeAuditLog(req.user!.id, "NOTIFICATION_SENT", "CandidateApplication", id, {
          recipient: candidate.email,
          channel: "email",
          reason: templateKey,
          subject,
          body,
        });
      } catch (emailErr) {
        console.error("Hiring decision recorded but notification email failed:", emailErr);
      }
    })();
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
    // "Actively being considered" now collapses to just SHORTLISTED -- under
    // the US-05 redesign, `stage` no longer changes while a candidate moves
    // through interview rounds (see currentVacancyStageId), so this single
    // filter covers everyone from "freshly shortlisted" through "in the
    // final round", exactly matching what the old 4-value `in` filter meant.
    const applications = await prisma.candidateApplication.findMany({
      where: {
        vacancyId,
        stage: "SHORTLISTED",
      },
      include: {
        candidate: true,
        decidedBy: true,
        currentVacancyStage: true,
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

// US-19: Hiring Manager's recommendation -- BINDING (reversed from advisory).
// ADVANCE moves the application into the vacancy's next HR-configured
// interview round; DO_NOT_PROGRESS rejects it outright. HR has no role in
// intermediate round progression -- this is the only action that moves a
// candidate through the interview rounds. (Final HIRED is still a separate,
// distinct action -- recordHiringDecision -- since that only makes sense
// once a candidate has actually completed the vacancy's last round.)
//
// Note: the old standalone updateApplicationStage (rank-based, fixed 7-stage
// enum) was deleted in the US-05 redesign rather than reworked -- it was
// already dead code (SUPERSEDED, NOT ROUTED per its own comment), and
// rewriting unreachable reference code to match a schema it never actually
// ran against would only drift further from reality.
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

    if (application.stage === "REJECTED" || application.stage === "HIRED") {
      return res.status(400).json({ error: "This application has already reached a final outcome" });
    }

    const onHoldError = await assertVacancyNotOnHold(application.vacancyId);
    if (onHoldError) {
      return res.status(400).json({ error: onHoldError });
    }

    if (recommendation === "ADVANCE") {
      // Only ADVANCE needs the SHORTLISTED gate -- it's the action that
      // actually enters/progresses interview rounds, which only make sense
      // post-shortlist. DO_NOT_PROGRESS has no such requirement (see below) --
      // same as the original fixed-stage version, which never gated
      // DO_NOT_PROGRESS on rank either.
      if (application.stage !== "SHORTLISTED") {
        return res.status(400).json({ error: "Candidate must be shortlisted before entering the interview process" });
      }

      const rounds = await prisma.vacancyStage.findMany({
        where: { vacancyId: application.vacancyId },
        orderBy: { order: "asc" },
      });

      if (rounds.length === 0) {
        return res.status(400).json({
          error: "This vacancy has no interview rounds configured yet. Ask HR to add at least one round before advancing candidates.",
        });
      }

      const nextRound =
        application.currentVacancyStageId === null
          ? rounds[0]
          : rounds[rounds.findIndex((r) => r.id === application.currentVacancyStageId) + 1];

      if (!nextRound) {
        return res.status(400).json({
          error: "Cannot advance - there is no further interview round. Use the hiring decision endpoint once the candidate has completed the final round.",
        });
      }

      await transitionApplicationStage(applicationId, { vacancyStageId: nextRound.id }, req.user!.id);
    } else {
      // DO_NOT_PROGRESS: the recommendation is the decision -- ends the
      // candidate's journey on this vacancy, same as any other rejection.
      await transitionApplicationStage(applicationId, { stage: "REJECTED" }, req.user!.id);
    }

    const created = await prisma.stageRecommendation.create({
      data: {
        applicationId,
        hiringManagerId: req.user!.id,
        recommendation: recommendation as any,
        // Was already a column on this model but never read from the request
        // body -- the HM's "Add Comments" note (corrections doc) had nowhere
        // to go. Wired up now instead of adding a new field.
        comments: comments && comments.trim() ? comments.trim() : null,
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

    // Mirrors the frontend's HR-detail-page lock: an HM should only ever be
    // attached to a candidate HR has actually shortlisted. Enforced here too
    // (not just disabling the button) since this endpoint has no other
    // stage check and is reachable directly, not only through that page.
    if (application.stage !== "SHORTLISTED") {
      return res.status(400).json({
        error: `Cannot assign a Hiring Manager to an application in ${application.stage} stage. Candidate must be shortlisted first.`,
      });
    }

    const onHoldError = await assertVacancyNotOnHold(application.vacancyId);
    if (onHoldError) {
      return res.status(400).json({ error: onHoldError });
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
// "APPLIED" is only ever valid here as the Reconsider target below -- it's
// not a normal decision target (there's no UI path that lets HR send an
// already-Applied application back to Applied).
const VALID_STATUS_TARGETS = ["SHORTLISTED", "REJECTED", "APPLIED"] as const;

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

    // "Reconsider" -- the one path back from REJECTED, and only for an
    // early CV-screening rejection (HR rejected the CV before it was ever
    // shortlisted), never for a rejection that came out of `recordHiringDecision`
    // after a real interview process (that's a `hiringDecision` value, a
    // separate field, and reopening a genuine final outcome is a bigger,
    // more deliberate action than this endpoint is meant for -- see
    // application.controller.ts's recordHiringDecision, which already
    // blocks re-deciding once stage is HIRED/REJECTED). Distinguished by
    // `hiringDecision` being null: an early-rejected application never had
    // one set in the first place.
    //
    // Correction (direct user feedback, caught by live testing): Reconsider
    // moves the application back to APPLIED ("Unreviewed"), NOT straight to
    // SHORTLISTED. It used to target SHORTLISTED, which let a reconsidered
    // candidate skip the CV-review-note requirement below entirely --
    // Shortlist/Reject always requires a freshly saved note, and Reconsider
    // isn't exempt from that just because this candidate already has one on
    // file from before. The stale note itself is cleared further down so
    // "already has a note" can't be used to route around this either.
    const isReconsider = status === "APPLIED" && existing.stage === "REJECTED" && existing.hiringDecision === null;
    if (existing.stage !== "APPLIED" && !isReconsider) {
      return res.status(400).json({
        error: existing.hiringDecision
          ? "This application already has a final hiring decision recorded and cannot be reopened here."
          : "Can only shortlist or reject an application that is still in the Applied stage, or reconsider one that was rejected before any hiring decision.",
      });
    }

    const onHoldError = await assertVacancyNotOnHold(existing.vacancyId);
    if (onHoldError) {
      return res.status(400).json({ error: onHoldError });
    }

    // Real gap the user caught by using the app: HR could Shortlist or
    // Reject straight off the CV-review screen without ever having written
    // down why -- Review Notes existed but were purely optional, so a
    // decision could leave zero record of the reasoning behind it. Only
    // gated on the actual CV-screening moment (existing.stage === "APPLIED"),
    // not the Reconsider path (existing.stage is "REJECTED" there -- there's
    // nothing to write a note against yet, the note comes after
    // reconsidering, when this candidate is screened again as Unreviewed).
    // Checked against Candidate.lastCvReviewNote -- the persisted, saved
    // note -- not whatever's sitting in the frontend's draft textarea, so a
    // note that was typed but never actually saved still can't be used to
    // unlock the decision.
    if (existing.stage === "APPLIED") {
      const candidate = await prisma.candidate.findUnique({
        where: { id: existing.candidateId },
        select: { lastCvReviewNote: true },
      });
      if (!candidate?.lastCvReviewNote?.trim()) {
        return res.status(400).json({
          error: "Write and save a CV review note before shortlisting or rejecting this candidate.",
        });
      }
    }

    const updated = await transitionApplicationStage(id, { stage: status as any }, req.user!.id);

    // Clear the stale review note as part of reconsidering, so HR is
    // prompted to write a fresh one for this new look rather than the old
    // rejection's note silently counting as "already reviewed."
    if (isReconsider) {
      await prisma.candidate.update({
        where: { id: existing.candidateId },
        data: { lastCvReviewNote: null, lastCvReviewedByUserId: null, lastCvReviewedAt: null },
      });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update application status" });
  }
}
