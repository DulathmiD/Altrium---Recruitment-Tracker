import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "../prisma.js";
import { writeAuditLog } from "../utils/auditLog.js";
import { extractCvData } from "../utils/cvExtraction.js";
import { fileExists, getFile, renameFile, sanitizeForFilename, saveFile } from "../utils/fileStorage.js";
import { initializeApplicationStage } from "../utils/stageTransition.js";

// US-05 redesign: only the 4 fixed anchors filter here via `stage`.
// Filtering by a specific interview round is separate -- `vacancyStageId`
// below -- since round identity is per-vacancy (not a global name). Frontend
// corrections pass: the Candidates screen's "Stage" filter now means the
// interview round (e.g. "Software Engineer - Technical Interview"), not this
// coarse anchor, so this param is what actually backs it now.
const VALID_STAGES = ["APPLIED", "SHORTLISTED", "HIRED", "REJECTED"] as const;

// US-13 fix: this used to list one row per Candidate, which breaks once a
// candidate applies to more than one vacancy -- there's no single `stage` to
// show, since stage lives on CandidateApplication, not Candidate. Decided
// (see decision log, "Candidates screen: row scope resolved") to list one row
// per candidate-application instead, each carrying its own vacancy + stage.
// A candidate with 2 applications now correctly appears as 2 rows.
export async function listCandidates(req: Request, res: Response) {
  const { search, vacancyId, stage, vacancyStageId, minScore } = req.query as {
    search?: string;
    vacancyId?: string;
    stage?: string;
    vacancyStageId?: string;
    minScore?: string;
  };

  if (stage && !VALID_STAGES.includes(stage as (typeof VALID_STAGES)[number])) {
    return res.status(400).json({ error: "Invalid stage filter" });
  }
  if (vacancyStageId && Number.isNaN(Number(vacancyStageId))) {
    return res.status(400).json({ error: "Invalid vacancyStageId filter" });
  }

  const where: any = {};
  if (vacancyId) where.vacancyId = Number(vacancyId);
  if (stage) where.stage = stage;
  if (vacancyStageId) where.currentVacancyStageId = Number(vacancyStageId);
  if (minScore) {
    where.interviews = {
      some: { feedback: { some: { score: { gte: Number(minScore) } } } },
    };
  }
  if (search) {
    where.candidate = { OR: [{ name: { contains: search } }, { email: { contains: search } }] };
  }

  try {
    const applications = await prisma.candidateApplication.findMany({
      where,
      include: {
        candidate: { include: { lastCvReviewedBy: true } },
        vacancy: true,
        currentVacancyStage: true,
        hiringManager: true,
      },
      orderBy: { appliedAt: "desc" },
    });
    res.json(applications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list candidates" });
  }
}

// Task #44: human-readable label for each NOTIFICATION_SENT "reason" string
// that's actually sent to a *candidate* (as opposed to a panelist, or a
// password-reset email to a staff User -- neither of those is relevant to a
// candidate's own Email History). Falls back to the raw reason string for
// anything not listed here so a future email type doesn't silently vanish.
const CANDIDATE_EMAIL_LABEL: Record<string, string> = {
  hiring_decision_hire: "Offer email",
  hiring_decision_reject: "Rejection email",
  interview_scheduled_candidate: "Interview invitation",
};

export async function getCandidate(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid candidate id" });
  }

  try {
    // Read-only. This used to also stamp lastCvReviewedByUserId/At on every
    // fetch ("viewing the detail page IS the review") -- corrected per user
    // feedback: simply opening a candidate's row shouldn't silently count as
    // having reviewed their CV before HR has actually looked at it. The
    // review stamp now only happens via markCvReviewed() below, which the
    // frontend fires from an explicit "View CV" action on this same page --
    // so it takes both opening the candidate AND actually viewing the CV,
    // not either alone.
    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        applications: {
          include: { vacancy: true, currentVacancyStage: true },
          orderBy: { appliedAt: "desc" },
        },
        lastCvReviewedBy: true,
      },
    });
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    // Task #44 (Email History): AuditLog's metadata originally only stored
    // {recipient, channel, reason} for a NOTIFICATION_SENT entry -- no way to
    // show the actual message content, just "what kind of email, when." The
    // three candidate-facing send sites (recordHiringDecision's HIRE/REJECT
    // email, scheduleInterview/addCandidatesToSlot's round-1 auto-invite, and
    // Follow Ups' manual invite send) now also persist `subject`/`body` in
    // that same metadata blob, so a real email sent after this change carries
    // its content here; anything sent before it just won't have `subject`/
    // `body` set, and the frontend falls back to "not available" for those.
    // Filtering happens in JS rather than a JSON-path Prisma query (metadata
    // is a generic Json column shared by 10 other AuditActions with
    // different shapes) -- simpler and safer than relying on the DB driver's
    // JSON path filter syntax for one field.
    const notificationLogs = await prisma.auditLog.findMany({
      where: { action: "NOTIFICATION_SENT" },
      orderBy: { createdAt: "desc" },
    });
    const emailHistory = notificationLogs
      .filter((log) => {
        const recipient = (log.metadata as Record<string, unknown> | null)?.recipient;
        return typeof recipient === "string" && recipient.toLowerCase() === candidate.email.toLowerCase();
      })
      .map((log) => {
        const meta = log.metadata as Record<string, unknown> | null;
        const reason = meta?.reason;
        const reasonStr = typeof reason === "string" ? reason : "";
        const subject = typeof meta?.subject === "string" ? meta.subject : null;
        const body = typeof meta?.body === "string" ? meta.body : null;
        return {
          id: log.id,
          label: CANDIDATE_EMAIL_LABEL[reasonStr] ?? "Email",
          sentAt: log.createdAt,
          subject,
          body,
        };
      });

    res.json({ ...candidate, emailHistory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch candidate" });
  }
}

// The actual review-stamp write, moved out of getCandidate() above. Fired
// by the frontend's "View CV" button on the candidate detail page -- so it
// takes both opening the candidate's row (to reach that page) AND clicking
// to view the CV, not either action alone. Doesn't touch the standalone
// "View" link on the Candidates list page (downloadCv, below), which stays
// a plain CV fetch with no side effect -- viewing a CV from the list
// without ever opening the candidate shouldn't count as a review either.
export async function markCvReviewed(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid candidate id" });
  }

  try {
    const existing = await prisma.candidate.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    const candidate = await prisma.candidate.update({
      where: { id },
      data: {
        lastCvReviewedByUserId: req.user!.id,
        lastCvReviewedAt: new Date(),
      },
      include: { lastCvReviewedBy: true },
    });

    res.json(candidate);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not mark candidate as reviewed" });
  }
}

export async function updateCandidate(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid candidate id" });
  }

  // cvUrl is deliberately not editable here -- it's an internal storage
  // filename now (set only by confirmCvUpload), not free text. Accepting it
  // from the client would let a caller point a candidate's cvUrl at an
  // arbitrary path, which downloadCv() would then try to read from disk.
  const { name, email, phoneNumber, reviewNote } = req.body as {
    name?: string;
    email?: string;
    phoneNumber?: string;
    reviewNote?: string;
  };

  try {
    // Bug caught via live testing: saving a review note here never stamped
    // lastCvReviewedByUserId/At -- only markCvReviewed() (fired by the
    // frontend's View CV button) did, so "Last Reviewed By" stayed "Not yet
    // reviewed" even right after HR wrote and saved a real note. Writing a
    // note down IS an act of reviewing the CV, so it should stamp the same
    // fields markCvReviewed does, not require a separate View CV click first
    // (which also silently never happens if the CV file itself is missing
    // from storage, compounding the confusion).
    const candidate = await prisma.candidate.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phoneNumber !== undefined ? { phoneNumber } : {}),
        ...(reviewNote !== undefined ? { lastCvReviewNote: reviewNote } : {}),
        ...(reviewNote !== undefined
          ? { lastCvReviewedByUserId: req.user!.id, lastCvReviewedAt: new Date() }
          : {}),
      },
      include: { lastCvReviewedBy: true },
    });

    res.json(candidate);
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Candidate not found" });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ error: "A candidate with this email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not update candidate" });
  }
}

// --- Real CV file upload (US-06/US-07 merged): two-phase extract -> confirm ---
// Phase 1 saves each uploaded PDF to disk immediately (so nothing is lost if
// HR abandons the review step) and best-effort extracts name/email/phone.
// No Candidate rows are created here -- that only happens on confirm, once
// HR has reviewed/corrected the extracted fields.
//
// Frontend-corrections pass: a non-PDF file used to fail the *entire* batch
// with one request-level error. Wireframe expects mixed batches to work --
// good files still upload, bad ones are individually reported as "Failed" in
// a results table -- so this now skips (not aborts on) a non-PDF file and
// reports it back per-file instead.
export async function extractCvFiles(req: Request, res: Response) {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No files uploaded (field name must be 'files')" });
  }

  const results: {
    fileId: string;
    originalName: string;
    extractedName: string | null;
    extractedEmail: string | null;
    extractedPhone: string | null;
  }[] = [];
  const failed: { originalName: string; error: string }[] = [];

  for (const file of files) {
    // R-09 in the risk register: `file.mimetype` here is whatever the
    // uploading browser/client declared in the multipart form field -- it's
    // client-supplied metadata, not a fact about the bytes, so a renamed
    // .exe with a forged "application/pdf" field would previously have
    // sailed through this check untouched. A real PDF's first 5 bytes are
    // always the literal signature "%PDF-" regardless of what the client
    // claims, so checking that against the actual buffer (from multer's
    // memoryStorage, already fully in memory at this point) is a real
    // content check rather than trusting a label. Not a full PDF parse/
    // validity check -- just enough to reject anything that isn't at least
    // byte-for-byte shaped like a PDF at the start.
    const isRealPdf = file.buffer.length >= 5 && file.buffer.subarray(0, 5).toString("latin1") === "%PDF-";
    if (file.mimetype !== "application/pdf" || !isRealPdf) {
      failed.push({ originalName: file.originalname, error: "Not a PDF file" });
      continue;
    }

    const fileId = `${randomUUID()}.pdf`;
    await saveFile(file.buffer, fileId);

    let extractedName: string | null = null;
    let extractedEmail: string | null = null;
    let extractedPhone: string | null = null;
    try {
      const extracted = await extractCvData(file.buffer);
      extractedName = extracted.name;
      extractedEmail = extracted.email;
      extractedPhone = extracted.phone;
    } catch (err) {
      // Extraction failing (e.g. a scanned/image-only PDF with no text layer)
      // must not block the upload -- the file is already saved, HR just has
      // to fill in the fields manually on the review step.
      console.error(`CV extraction failed for ${file.originalname}:`, err);
    }

    results.push({ fileId, originalName: file.originalname, extractedName, extractedEmail, extractedPhone });
  }

  res.status(200).json({ files: results, failed });
}

// Phase 2: HR has reviewed/corrected each file's extracted data and confirms.
// This is the point where Candidate rows actually get created.
//
// SCRUM2-30 (duplicate candidate detection): looks up an existing Candidate
// by email before attempting to create one. Two outcomes on a match:
//
// - Same vacancy (this exact candidate already has an application for the
//   vacancy this upload targets): a genuine duplicate-application attempt,
//   same as any other "already applied" case elsewhere in the app. Nothing
//   changes -- the CV already on file stays as-is, no application is
//   created or reset -- and the match is reported back so HR can click
//   through and confirm it's really the same person, but there is no
//   decision to make here (see the reverted-feature note in the project
//   decision log for why this was deliberately simplified back down from a
//   multi-round "use new CV / keep current CV" review flow).
// - A genuinely different vacancy they've never applied to (or no target
//   vacancy at all): not a conflict -- reuses the existing Candidate row
//   (email is unique at the DB level), silently updates their CV/name/
//   phone, and proceeds exactly like a brand-new upload. The
//   CandidateApplication itself is created by the frontend's existing
//   post-confirm loop (one applyCandidateToVacancy call per `created`
//   entry), same as for a brand-new candidate.
export async function confirmCvUpload(req: Request, res: Response) {
  const { candidates, vacancyId } = req.body as {
    candidates?: { fileId?: string; name?: string; email?: string; phoneNumber?: string }[];
    vacancyId?: number;
  };

  if (!candidates || candidates.length === 0) {
    return res.status(400).json({ error: "candidates array is required" });
  }

  const created: { fileId: string; candidateId: number; email: string }[] = [];
  // One entry per email match this batch produced, purely informational --
  // the frontend uses this to show "existing candidate(s) found" with a
  // link to their profile. `applicationId` is only set for the same-vacancy
  // case (the existing application to link to); for the cross-vacancy case
  // the frontend already knows the new application's id from its own
  // per-`created`-entry applyCandidateToVacancy call.
  const matched: {
    fileId: string;
    candidateId: number;
    email: string;
    existingName: string;
    alreadyOnThisVacancy: boolean;
    applicationId: number | null;
  }[] = [];
  const failed: { fileId?: string; error: string }[] = [];

  const targetVacancy = vacancyId
    ? await prisma.vacancy.findUnique({ where: { id: vacancyId }, select: { id: true, title: true } })
    : null;

  for (const entry of candidates) {
    const { fileId, name, email, phoneNumber } = entry;

    if (!fileId || !name || !email) {
      failed.push({ ...(fileId !== undefined ? { fileId } : {}), error: "fileId, name, and email are required" });
      continue;
    }

    if (!(await fileExists(fileId))) {
      failed.push({ fileId, error: "CV file not found in storage - it may have expired, please re-upload" });
      continue;
    }

    try {
      const existing = await prisma.candidate.findUnique({
        where: { email },
        include: { applications: { include: { vacancy: true } } },
      });

      const existingApplicationOnTarget = targetVacancy
        ? existing?.applications.find((a) => a.vacancyId === targetVacancy.id) ?? null
        : null;

      if (existing && existingApplicationOnTarget) {
        // Already applied to this exact vacancy -- the newly uploaded file
        // is simply not used (left in storage, same as any other
        // never-attached upload). Nothing about the existing application
        // changes.
        matched.push({
          fileId,
          candidateId: existing.id,
          email: existing.email,
          existingName: existing.name,
          alreadyOnThisVacancy: true,
          applicationId: existingApplicationOnTarget.id,
        });
        continue;
      }

      if (existing) {
        // Existing candidate (matched by email), but a genuinely different
        // vacancy (or no target vacancy at all) -- reuses this Candidate row
        // instead of erroring on the unique email constraint, and proceeds
        // exactly like a brand-new upload.
        await prisma.candidate.update({
          where: { id: existing.id },
          data: { cvUrl: fileId, name, ...(phoneNumber !== undefined ? { phoneNumber } : {}) },
        });

        const finalFilename = `${existing.id}_${sanitizeForFilename(name)}.pdf`;
        try {
          await renameFile(fileId, finalFilename);
          await prisma.candidate.update({ where: { id: existing.id }, data: { cvUrl: finalFilename } });
        } catch (renameErr) {
          console.error(`Could not rename CV file for candidate ${existing.id}, keeping original filename:`, renameErr);
        }

        await writeAuditLog(req.user!.id, "CV_UPLOADED", "Candidate", existing.id, {
          name,
          email: existing.email,
          source: "file",
        });

        matched.push({
          fileId,
          candidateId: existing.id,
          email: existing.email,
          existingName: existing.name,
          alreadyOnThisVacancy: false,
          applicationId: null,
        });
        created.push({ fileId, candidateId: existing.id, email: existing.email });
        continue;
      }

      const candidate = await prisma.candidate.create({
        data: { name, email, cvUrl: fileId, ...(phoneNumber !== undefined ? { phoneNumber } : {}) },
      });

      // Rename on disk to embed the candidate id + confirmed name, so files
      // stay human-identifiable and same-named candidates never collide.
      const finalFilename = `${candidate.id}_${sanitizeForFilename(name)}.pdf`;
      try {
        await renameFile(fileId, finalFilename);
        await prisma.candidate.update({ where: { id: candidate.id }, data: { cvUrl: finalFilename } });
      } catch (renameErr) {
        console.error(`Could not rename CV file for candidate ${candidate.id}, keeping original filename:`, renameErr);
      }

      await writeAuditLog(req.user!.id, "CV_UPLOADED", "Candidate", candidate.id, {
        name: candidate.name,
        email: candidate.email,
        source: "file",
      });

      created.push({ fileId, candidateId: candidate.id, email: candidate.email });
    } catch (err) {
      console.error(err);
      failed.push({ fileId, error: "Could not create this candidate" });
    }
  }

  res.status(201).json({
    createdCount: created.length,
    matchedCount: matched.length,
    failedCount: failed.length,
    created,
    matched,
    failed,
  });
}

// Authenticated CV download/view -- deliberately not a public express.static()
// folder (same reasoning as the earlier passwordHash/resetToken leak fix:
// files that identify or expose personal data must go through an auth check,
// never sit behind a guessable public URL).
export async function downloadCv(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid candidate id" });
  }

  try {
    const candidate = await prisma.candidate.findUnique({ where: { id } });
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    if (!candidate.cvUrl) {
      return res.status(404).json({ error: "No CV on file for this candidate" });
    }

    let buffer: Buffer;
    try {
      buffer = await getFile(candidate.cvUrl);
    } catch {
      return res.status(404).json({ error: "CV file not found in storage" });
    }

    // cvUrl is the storage key, which may carry a "rejected/" archive prefix
    // (see stageTransition.ts) -- strip any folder-style prefix so the
    // browser-facing filename doesn't expose internal storage layout.
    const displayFilename = candidate.cvUrl.split("/").pop() || candidate.cvUrl;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${displayFilename}"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch CV" });
  }
}
