import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Bug fix: the mariadb driver's own connection-string parser
// (node_modules/mariadb/lib/config/connection-options.js) splits query
// params on a literal "=" with no allowlist -- so "?ssl-mode=REQUIRED"
// (the exact format Aiven's connection string uses) becomes a property
// literally named "ssl-mode" on the parsed options object. The driver's
// ConnectionOptions constructor only ever reads `opts.ssl`, never
// `opts["ssl-mode"]`, so that property was silently dropped and TLS was
// never actually enabled -- despite Aiven requiring it on every
// connection. Aiven rejects a non-TLS connection outright, so this failed
// on every single query, not intermittently (explains why a retry alone
// didn't help). Fix: parse the URL ourselves and pass an explicit config
// object with `ssl` set as a real boolean, bypassing the driver's string
// parser entirely for this option.
const rawUrl = process.env["DATABASE_URL"]!;
const parsedUrl = new URL(rawUrl.replace(/^mysql:\/\//, "mariadb://"));
const requiresSsl =
  parsedUrl.searchParams.get("ssl-mode") === "REQUIRED" ||
  parsedUrl.searchParams.get("sslmode") === "require" ||
  parsedUrl.searchParams.get("ssl") === "true";

const adapter = new PrismaMariaDb({
  host: parsedUrl.hostname,
  port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
  user: decodeURIComponent(parsedUrl.username),
  password: decodeURIComponent(parsedUrl.password),
  database: parsedUrl.pathname.replace(/^\//, ""),
  ...(requiresSsl ? { ssl: { rejectUnauthorized: true } } : {}),
});

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
