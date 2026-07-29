import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../prisma.js";
import { signToken } from "../utils/jwt.js";

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken({
    id: user.id,
    role: user.role,
    department: user.department,
  });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    },
  });
}

export async function me(req: Request, res: Response) {
  res.json({ user: req.user });
}
