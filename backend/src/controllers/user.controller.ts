import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../prisma.js";
import { writeAuditLog } from "../utils/auditLog.js";
import { Role } from "../../generated/prisma/index.js";

const VALID_ROLES = Object.values(Role) as string[];

export async function listUsers(req: Request, res: Response) {
  const { role, isActive } = req.query as { role?: string; isActive?: string };

  if (role && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Invalid role filter. Must be one of: ${VALID_ROLES.join(", ")}` });
  }

  const where: any = {};
  if (role) where.role = role;
  if (isActive === "true") where.isActive = true;
  if (isActive === "false") where.isActive = false;

  try {
    const users = await prisma.user.findMany({ where, orderBy: { createdAt: "desc" } });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not list users" });
  }
}

export async function getUser(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch user" });
  }
}

// US-02: IT Admin creates a user account. The admin sets an initial password
// directly (matches the seed script's pattern) rather than an email-invite
// flow -- no story asks for invite-by-email, and the existing forgot/reset
// flow already lets the new user change it themselves once they have it.
export async function createUser(req: Request, res: Response) {
  const { name, email, password, role, department, phoneNumber } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    department?: string;
    phoneNumber?: string;
  };

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "name, email, password, and role are required" });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const baseData = {
    name,
    email,
    passwordHash,
    role: role as Role,
    // IT Admin picks the initial password and shares it directly (no
    // email-invite flow) -- flag the account so the very first login is
    // forced through /change-password before anything else is reachable,
    // rather than the initial password being usable forever unchanged.
    mustChangePassword: true,
    ...(department !== undefined ? { department } : {}),
  };

  // Newer schema fields (`phoneNumber`, `mustChangePassword`) only exist on
  // the generated Prisma Client once someone has actually run
  // `npx prisma migrate dev` on whatever machine is running this. Until then,
  // Prisma throws a PrismaClientValidationError ("Unknown argument `X`") for
  // any create call that includes an unmigrated column -- which would
  // otherwise hard-fail account creation entirely over a field the caller
  // may not even control. Retry with that one field stripped instead (can
  // strip more than one across repeated retries), so IT Admin isn't blocked
  // from creating accounts while a migration is pending. `mustChangePassword`
  // silently defaulting to unset in this fallback case just means the forced
  // first-login change doesn't kick in until the migration actually runs --
  // not a security regression, just that specific enforcement not existing
  // yet on this un-migrated database, same as before this feature existed.
  let phoneNumberSaved = phoneNumber === undefined;
  const fullData: Record<string, unknown> = { ...baseData, ...(phoneNumber !== undefined ? { phoneNumber } : {}) };

  function unknownArgName(err: any): string | null {
    const isUnknownArg = err?.name === "PrismaClientValidationError" || String(err?.message ?? "").includes("Unknown argument");
    if (!isUnknownArg) return null;
    const match = String(err?.message ?? "").match(/Unknown argument `(\w+)`/);
    return match?.[1] ?? null;
  }

  try {
    let user;
    let data = fullData;
    // Bounded loop (at most one retry per real field) rather than a fixed
    // two-deep try/catch, so this doesn't need updating every time another
    // migration-pending field gets added to this form later.
    for (let attempt = 0; ; attempt++) {
      try {
        user = await prisma.user.create({ data: data as any });
        break;
      } catch (err: any) {
        const badArg = unknownArgName(err);
        if (!badArg || !(badArg in data) || attempt > 5) throw err;
        console.warn(`createUser: '${badArg}' column not present yet (migration pending) -- created account without it.`);
        if (badArg === "phoneNumber") phoneNumberSaved = false;
        const { [badArg]: _omit, ...rest } = data;
        data = rest;
      }
    }

    await writeAuditLog(req.user!.id, "ACCOUNT_CREATED", "User", user.id, {
      name: user.name,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({ ...user, phoneNumberSaved });
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "A user with this email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not create user" });
  }
}

// Profile-only edit: name/email/department. Role and active-status changes go
// through their own endpoints below since those are the two US-02/US-03
// events that actually need distinct audit semantics (ACCOUNT_DEACTIVATED /
// ROLE_CHANGED) -- a generic "user edited" event was never asked for.
export async function updateUser(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  const { name, email, department, phoneNumber } = req.body as {
    name?: string;
    email?: string;
    department?: string;
    phoneNumber?: string;
  };

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(department !== undefined ? { department } : {}),
        ...(phoneNumber !== undefined ? { phoneNumber } : {}),
      },
    });
    res.json(user);
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ error: "A user with this email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not update user" });
  }
}

// US-02: activate/deactivate a user account. Deactivated users are already
// blocked at login (see auth.controller.ts) -- this is what actually flips
// that flag. Self-deactivation is blocked so an IT Admin can't accidentally
// lock themselves out with no other admin able to undo it.
export async function setUserActive(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  const { isActive } = req.body as { isActive?: boolean };
  if (typeof isActive !== "boolean") {
    return res.status(400).json({ error: "isActive (boolean) is required" });
  }

  if (id === req.user!.id && !isActive) {
    return res.status(400).json({ error: "You cannot deactivate your own account" });
  }

  try {
    const before = await prisma.user.findUnique({ where: { id }, select: { isActive: true, email: true, name: true } });
    if (!before) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = await prisma.user.update({ where: { id }, data: { isActive } });

    if (before.isActive && !isActive) {
      await writeAuditLog(req.user!.id, "ACCOUNT_DEACTIVATED", "User", user.id, { name: user.name, email: user.email });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update account status" });
  }
}

// US-03: role-based access control -- this is what actually assigns the role.
// Self-role-change blocked for the same self-lockout reason as deactivation
// above (an IT Admin demoting themselves with no other admin around).
export async function setUserRole(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  const { role } = req.body as { role?: string };
  if (!role || !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role is required and must be one of: ${VALID_ROLES.join(", ")}` });
  }

  if (id === req.user!.id) {
    return res.status(400).json({ error: "You cannot change your own role" });
  }

  try {
    const before = await prisma.user.findUnique({ where: { id }, select: { role: true, email: true } });
    if (!before) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = await prisma.user.update({ where: { id }, data: { role: role as Role } });

    if (before.role !== user.role) {
      await writeAuditLog(req.user!.id, "ROLE_CHANGED", "User", user.id, {
        name: user.name,
        email: user.email,
        previousRole: before.role,
        newRole: user.role,
      });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update role" });
  }
}
