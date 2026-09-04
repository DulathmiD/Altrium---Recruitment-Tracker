import type { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { Role } from "../../generated/prisma/index.js";

// Recruitment-relevant roles only -- HR/IT Admin/Leadership accounts are
// deliberately excluded from this list, this endpoint has nothing to do with
// them.
const ASSIGNABLE_ROLES = [Role.INTERVIEWER, Role.MANAGEMENT, Role.HIRING_MANAGER] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

// Narrow, HR-facing staff lookup for assigning a vacancy's interviewer pool
// and an application's Hiring Manager. Deliberately NOT the IT Admin
// `/users` endpoint (that stays IT_ADMIN-only for actual account
// management) -- this only ever returns active staff in the 3 roles
// relevant to recruitment, with a trimmed field set (no isActive/department/
// createdAt noise), so HR gets exactly what it needs without reusing an
// admin-scoped surface.
export async function listAssignableStaff(req: Request, res: Response) {
  const { role } = req.query as { role?: string };

  let roles: readonly AssignableRole[] = ASSIGNABLE_ROLES;
  if (role) {
    if (!ASSIGNABLE_ROLES.includes(role as AssignableRole)) {
      return res.status(400).json({ error: `role must be one of: ${ASSIGNABLE_ROLES.join(", ")}` });
    }
    roles = [role as AssignableRole];
  }

  try {
    const users = await prisma.user.findMany({
      where: { role: { in: roles as AssignableRole[] }, isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list staff" });
  }
}
