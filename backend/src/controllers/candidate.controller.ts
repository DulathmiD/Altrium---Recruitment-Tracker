import type { Request, Response } from "express";
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

export async function listCandidates(req: Request, res: Response) {
  const { search } = req.query as { search?: string };

  try {
    const candidates = await prisma.candidate.findMany({
      where: search
        ? {
            OR: [{ name: { contains: search } }, { email: { contains: search } }],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
    });
    res.json(candidates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list candidates" });
  }
}

export async function getCandidate(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid candidate id" });
  }

  try {
    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        applications: {
          include: { vacancy: true },
          orderBy: { appliedAt: "desc" },
        },
      },
    });

    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }

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
