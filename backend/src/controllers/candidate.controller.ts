import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "../prisma.js";
import { writeAuditLog } from "../utils/auditLog.js";
import { extractCvData } from "../utils/cvExtraction.js";
import { deleteFile, fileExists, getFile, renameFile, sanitizeForFilename, saveFile } from "../utils/fileStorage.js";

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
      include: {
        applications: {
          include: { vacancy: true, currentVacancyStage: true },
          orderBy: { appliedAt: "desc" },
        },
        lastCvReviewedBy: true,
      },
    });

    // Task #44 (Email History): AuditLog's metadata only ever stored
    // {recipient, channel, reason} for a NOTIFICATION_SENT entry -- there's
    // no subject/body column, so this can only show "what kind of email,
    // when," not the actual message content, unless the send paths are also
    // updated to persist subject/body. Filtering happens in JS rather than a
    // JSON-path Prisma query (metadata is a generic Json column shared by 10
    // other AuditActions with different shapes) -- simpler and safer than
    // relying on the DB driver's JSON path filter syntax for one field.
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
        const reason = (log.metadata as Record<string, unknown> | null)?.reason;
        const reasonStr = typeof reason === "string" ? reason : "";
        return {
          id: log.id,
          label: CANDIDATE_EMAIL_LABEL[reasonStr] ?? "Email",
          sentAt: log.createdAt,
        };
      });

    res.json({ ...candidate, emailHistory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch candidate" });
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
    const candidate = await prisma.candidate.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phoneNumber !== undefined ? { phoneNumber } : {}),
        ...(reviewNote !== undefined ? { lastCvReviewNote: reviewNote } : {}),
      },
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
    if (file.mimetype !== "application/pdf") {
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
// by email BEFORE attempting to create one, rather than the old approach of
// attempting the create and reacting to Prisma's P2002 unique-constraint
// error. That old approach worked (the frontend caught the specific error
// string and looked the candidate up itself to re-apply), but it made
// "duplicate found" an implicit side effect of a DB-constraint error message
// instead of a real, deliberately-built detection path -- fragile (a future
// wording change to that error string would have silently broken the
// re-apply logic) and invisible to HR (the merge happened silently, with no
// indication a new CV was actually an existing person). Matched entries are
// now their own explicit array in the response, and the frontend surfaces a
// clear warning naming who matched and which other vacancies they'd already
// applied to (see decision log: "warn, don't block" -- HR is told, but the
// application still gets created against the existing record either way).
export async function confirmCvUpload(req: Request, res: Response) {
  const { candidates } = req.body as {
    candidates?: { fileId?: string; name?: string; email?: string; phoneNumber?: string }[];
  };

  if (!candidates || candidates.length === 0) {
    return res.status(400).json({ error: "candidates array is required" });
  }

  const created: { fileId: string; candidateId: number; email: string }[] = [];
  const matched: {
    fileId: string;
    candidateId: number;
    email: string;
    existingName: string;
    existingVacancies: string[];
  }[] = [];
  const failed: { fileId?: string; error: string }[] = [];

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

      if (existing) {
        // Duplicate detected (CV+email, cross-vacancy scope per the decision
        // log): don't create a second Candidate row -- email is unique at
        // the DB level anyway -- link this upload to the existing person
        // instead. The newly-uploaded CV file itself is left in storage
        // unused; only the previously reviewed/confirmed CV stays attached
        // to the candidate record.
        matched.push({
          fileId,
          candidateId: existing.id,
          email: existing.email,
          existingName: existing.name,
          existingVacancies: existing.applications.map((a) => a.vacancy.title),
        });
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

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${candidate.cvUrl}"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch CV" });
  }
}
