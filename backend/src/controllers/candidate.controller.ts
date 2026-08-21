import type { Request, Response } from "express";
import { parse } from "csv-parse/sync";
import { prisma } from "../prisma.js";

export async function createCandidate(req: Request, res: Response) {
  const { name, email, phoneNumber, cvUrl } = req.body as {
    name?: string;
    email?: string;
    phoneNumber?: string;
    cvUrl?: string;
  };

  if (!name || !email || !cvUrl) {
    return res.status(400).json({ error: "name, email, and cvUrl are required" });
  }

  try {
    const candidate = await prisma.candidate.create({
      data: { name, email, phoneNumber, cvUrl },
    });
    res.status(201).json(candidate);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "A candidate with this email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not create candidate" });
  }
}

const VALID_STATUSES = ["APPLIED", "SHORTLISTED", "REJECTED", "IN_PROGRESS", "HIRED"] as const;

export async function listCandidates(req: Request, res: Response) {
  const { search, vacancyId, stageId, status, minScore } = req.query as {
    search?: string;
    vacancyId?: string;
    stageId?: string;
    status?: string;
    minScore?: string;
  };

  if (status && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return res.status(400).json({ error: "Invalid status filter" });
  }

  const applicationFilter: any = {};
  if (vacancyId) applicationFilter.vacancyId = Number(vacancyId);
  if (stageId) applicationFilter.currentStageId = Number(stageId);
  if (status) applicationFilter.status = status;
  if (minScore) {
    applicationFilter.interviews = {
      some: { feedback: { some: { score: { gte: Number(minScore) } } } },
    };
  }

  const where: any = {};
  if (search) {
    where.OR = [{ name: { contains: search } }, { email: { contains: search } }];
  }
  if (Object.keys(applicationFilter).length > 0) {
    where.applications = { some: applicationFilter };
  }

  try {
    const candidates = await prisma.candidate.findMany({
      where,
      include: { lastCvReviewedBy: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(candidates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list candidates" });
  }
}

type CsvRow = { name?: string; email?: string; phonenumber?: string; cvurl?: string };

export async function bulkUploadCandidates(req: Request, res: Response) {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    return res.status(400).json({ error: "No CSV file uploaded (field name must be 'file')" });
  }

  let rows: CsvRow[];
  try {
    rows = parse(file.buffer, {
      columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (err) {
    return res.status(400).json({ error: "Could not parse CSV file. Expected columns: name,email,phoneNumber,cvUrl" });
  }

  if (rows.length === 0) {
    return res.status(400).json({ error: "CSV file has no data rows" });
  }

  const created: { row: number; email: string }[] = [];
  const failed: { row: number; email?: string; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +1 for 0-index, +1 for header row

    if (!row.name || !row.email || !row.cvurl) {
      failed.push({ row: rowNumber, email: row.email, error: "Missing required field(s): name, email, cvUrl" });
      continue;
    }

    try {
      await prisma.candidate.create({
        data: {
          name: row.name,
          email: row.email,
          phoneNumber: row.phonenumber || undefined,
          cvUrl: row.cvurl,
        },
      });
      created.push({ row: rowNumber, email: row.email });
    } catch (err: any) {
      if (err.code === "P2002") {
        failed.push({ row: rowNumber, email: row.email, error: "A candidate with this email already exists" });
      } else {
        failed.push({ row: rowNumber, email: row.email, error: "Could not create this row" });
      }
    }
  }

  res.status(201).json({
    totalRows: rows.length,
    createdCount: created.length,
    failedCount: failed.length,
    created,
    failed,
  });
}

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
          include: { vacancy: true },
          orderBy: { appliedAt: "desc" },
        },
        lastCvReviewedBy: true,
      },
    });

    res.json(candidate);
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

  const { name, email, phoneNumber, cvUrl } = req.body as {
    name?: string;
    email?: string;
    phoneNumber?: string;
    cvUrl?: string;
  };

  try {
    const candidate = await prisma.candidate.update({
      where: { id },
      data: { name, email, phoneNumber, cvUrl },
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
