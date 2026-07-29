import jwt from "jsonwebtoken";
import { Role } from "../../generated/prisma/index.js";

const JWT_SECRET = process.env["JWT_SECRET"]!;

export interface JwtPayload {
  id: number;
  role: Role;
  department: string | null;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
