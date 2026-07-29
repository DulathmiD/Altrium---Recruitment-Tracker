import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// the mariadb driver's own URL parser requires "mariadb://", not "mysql://" (which is what
// DATABASE_URL uses everywhere else, e.g. prisma.config.ts and the mysql2 package)
const mariadbUrl = process.env["DATABASE_URL"]!.replace(/^mysql:\/\//, "mariadb://");
const adapter = new PrismaMariaDb(mariadbUrl);

export const prisma = new PrismaClient({ adapter });
