import type { Request, Response, NextFunction } from "express";
import { Role } from "../../generated/prisma/index.js";

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to do this" });
    }

    next();
  };
}
