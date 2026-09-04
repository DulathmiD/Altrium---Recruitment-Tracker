import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";

// Auto-mock: any prisma.<model>.<method>(...) call resolves to `undefined`.
// This is deliberate, not an oversight -- buildDashboardData/etc. always
// expect a real array or object back from Prisma, so touching `.length`,
// `.map`, `.filter`, or destructuring on `undefined` throws naturally. That
// throw is exactly the "something went wrong fetching report data" scenario
// this test exists to exercise, without needing to hand-build realistic
// department/vacancy/application data for 8 different report types.
vi.mock("../prisma.js", () => {
  const handler: ProxyHandler<object> = {
    get: (_t, prop) => (prop === "then" ? undefined : new Proxy(() => Promise.resolve(undefined), handler)),
  };
  return { prisma: new Proxy({}, handler) };
});

const { getReportPdf: getManagementReportPdf } = await import("../controllers/management.controller.js");
const { getReportPdf: getLeadershipReportPdf } = await import("../controllers/leadership.controller.js");

function mockRes() {
  const res = {} as Response;
  (res as any).status = vi.fn().mockReturnValue(res);
  (res as any).json = vi.fn().mockReturnValue(res);
  (res as any).setHeader = vi.fn().mockReturnValue(res);
  return res;
}

// Regression test for the bug fixed this session: getReportPdf used to set
// PDF response headers and call doc.pipe(res) BEFORE the data fetch had
// completed, so a fetch failure fell into a catch block that tried to send a
// second, JSON response on top of an already-started PDF stream -- corrupting
// the downloaded file. The fix splits fetch-then-stream into two try/catch
// blocks. This test locks in the specific, observable contract of that fix:
// on a data-fetch failure, no PDF header is ever set, and the client gets a
// clean JSON 500 instead.
describe("getReportPdf (management) - fetch-then-stream fix", () => {
  it("returns a clean JSON 500 and never sets PDF headers when the data fetch fails", async () => {
    const req = { user: { department: "Engineering" }, params: { type: "hiring-summary" } } as unknown as Request;
    const res = mockRes();

    await getManagementReportPdf(req, res);

    expect((res as any).setHeader).not.toHaveBeenCalled();
    expect((res as any).status).toHaveBeenCalledWith(500);
    expect((res as any).json).toHaveBeenCalledWith({ error: "Could not build report PDF" });
  });

  it("rejects an unknown report type before touching the database", async () => {
    const req = { user: { department: "Engineering" }, params: { type: "not-a-real-report" } } as unknown as Request;
    const res = mockRes();

    await getManagementReportPdf(req, res);

    expect((res as any).status).toHaveBeenCalledWith(400);
    expect((res as any).setHeader).not.toHaveBeenCalled();
  });

  it("requires a department on the requesting user's account", async () => {
    const req = { user: { department: null }, params: { type: "hiring-summary" } } as unknown as Request;
    const res = mockRes();

    await getManagementReportPdf(req, res);

    expect((res as any).status).toHaveBeenCalledWith(400);
    expect((res as any).json).toHaveBeenCalledWith({ error: "No department is set on your account" });
  });
});

describe("getReportPdf (leadership) - fetch-then-stream fix", () => {
  it("returns a clean JSON 500 and never sets PDF headers when the data fetch fails", async () => {
    const req = { user: {}, params: { type: "recruitment-performance" } } as unknown as Request;
    const res = mockRes();

    await getLeadershipReportPdf(req, res);

    expect((res as any).setHeader).not.toHaveBeenCalled();
    expect((res as any).status).toHaveBeenCalledWith(500);
    expect((res as any).json).toHaveBeenCalledWith({ error: "Could not build report PDF" });
  });

  it("rejects an unknown report type before touching the database", async () => {
    const req = { user: {}, params: { type: "not-a-real-report" } } as unknown as Request;
    const res = mockRes();

    await getLeadershipReportPdf(req, res);

    expect((res as any).status).toHaveBeenCalledWith(400);
    expect((res as any).setHeader).not.toHaveBeenCalled();
  });
});
