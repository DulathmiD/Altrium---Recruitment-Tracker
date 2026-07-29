import { Role } from "../../generated/prisma/index.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        role: Role;
        department: string | null;
      };
    }
  }
}

export {};
