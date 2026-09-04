import { describe, it, expect, vi } from "vitest";

// feedback.controller.ts imports the real Prisma client at module scope
// (src/prisma.ts constructs a PrismaMariaDb adapter from process.env.DATABASE_URL
// immediately on import), which would crash in this sandbox with no DB
// connection -- so every test file that imports anything from a controller
// must mock "../prisma.js" first, even when the thing under test (here,
// isValidScore) never touches Prisma itself. The mock below is a "return
// undefined from everything" auto-mock: fine here since isValidScore is a
// pure function and no test in this file calls a Prisma method.
vi.mock("../prisma.js", () => {
  const handler: ProxyHandler<object> = {
    get: (_t, prop) => (prop === "then" ? undefined : new Proxy(() => Promise.resolve(undefined), handler)),
  };
  return { prisma: new Proxy({}, handler) };
});

const { isValidScore } = await import("../controllers/feedback.controller.js");

// Regression coverage for the "1-10 with no server-side range enforcement"
// gap flagged in wireframe review round 1 (see docs/project-decisions-log.md)
// and later closed. Every screen that reads a score assumes this exact
// range, so the write-side guard is worth pinning down with tests.
describe("isValidScore", () => {
  it.each([1, 5, 10])("accepts whole numbers in range (%i)", (score) => {
    expect(isValidScore(score)).toBe(true);
  });

  it.each([0, -1, 11, 100])("rejects out-of-range whole numbers (%i)", (score) => {
    expect(isValidScore(score)).toBe(false);
  });

  it("rejects non-integer scores", () => {
    expect(isValidScore(5.5)).toBe(false);
  });

  it.each([undefined, null, "8", {}, [], NaN])("rejects non-number inputs (%p)", (score) => {
    expect(isValidScore(score)).toBe(false);
  });
});
