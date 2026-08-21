import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// the mariadb driver's own URL parser requires "mariadb://", not "mysql://" (which is what
// DATABASE_URL uses everywhere else, e.g. prisma.config.ts and the mysql2 package)
const mariadbUrl = process.env["DATABASE_URL"]!.replace(/^mysql:\/\//, "mariadb://");
const adapter = new PrismaMariaDb(mariadbUrl);

// Global omit: every query returns User rows without these fields, no matter which
// controller nests a user in via `include`. This is a deliberate single point of
// enforcement -- fixing it per-controller (adding `select` everywhere a user is
// nested) would rely on every future include site remembering to do the same thing.
export const prisma = new PrismaClient({
  adapter,
  omit: {
    user: {
      passwordHash: true,
      resetTokenHash: true,
      resetTokenExpiresAt: true,
    },
  },
});
