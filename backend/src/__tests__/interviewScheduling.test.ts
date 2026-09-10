import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression coverage for the Forty-third pass ("candidate is in two
// vacancies at once" gap): scheduleInterview() used to only check PANELISTS
// for a double-booking at the exact scheduled timestamp, never the
// candidate. Mocks every Prisma model method scheduleInterview touches
// (same per-model style as interviewReminders.test.ts, not a blanket Proxy)
// since these tests need to control return values per model and assert on
// which ones were/weren't called.
const candidateApplicationFindUnique = vi.fn();
const vacancyStageFindUnique = vi.fn();
const vacancyStageFindFirst = vi.fn();
const interviewFindFirst = vi.fn();
const vacancyInterviewerFindMany = vi.fn();
const interviewSlotFindFirst = vi.fn();
const userFindMany = vi.fn();
const transactionMock = vi.fn();

vi.mock("../prisma.js", () => ({
  prisma: {
    candidateApplication: { findUnique: (...args: unknown[]) => candidateApplicationFindUnique(...args) },
    vacancyStage: {
      findUnique: (...args: unknown[]) => vacancyStageFindUnique(...args),
      findFirst: (...args: unknown[]) => vacancyStageFindFirst(...args),
    },
    interview: { findFirst: (...args: unknown[]) => interviewFindFirst(...args) },
    vacancyInterviewer: { findMany: (...args: unknown[]) => vacancyInterviewerFindMany(...args) },
    interviewSlot: { findFirst: (...args: unknown[]) => interviewSlotFindFirst(...args) },
    user: { findMany: (...args: unknown[]) => userFindMany(...args) },
    $transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

const sendEmailMock = vi.fn();
vi.mock("../utils/mailer.js", () => ({ sendEmail: (...args: unknown[]) => sendEmailMock(...args) }));

const writeAuditLogMock = vi.fn();
vi.mock("../utils/auditLog.js", () => ({ writeAuditLog: (...args: unknown[]) => writeAuditLogMock(...args) }));

const renderTemplateMock = vi.fn();
vi.mock("../utils/notificationTemplates.js", () => ({
  renderTemplate: (...args: unknown[]) => renderTemplateMock(...args),
}));

const notifyUserMock = vi.fn();
vi.mock("../utils/notify.js", () => ({ notifyUser: (...args: unknown[]) => notifyUserMock(...args) }));

const { scheduleInterview } = await import("../controllers/interview.controller.js");

// Typed `any` deliberately -- this is a minimal stand-in for Express's
// Response (just status()/json()), not a full mock of it, and tsc --noEmit
// (run across the whole backend, not just via vitest's esbuild transform
// which skips type-checking) will otherwise reject passing it into a
// controller typed to expect the real Response.
function makeRes(): any {
  const res: { statusCode?: number; body?: unknown; status: (n: number) => any; json: (b: unknown) => any } = {
    status(n: number) {
      this.statusCode = n;
      return this;
    },
    json(b: unknown) {
      this.body = b;
      return this;
    },
  } as any;
  return res;
}

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    params: { id: "501" },
    body: { vacancyStageId: 10, scheduledAt: "2026-09-15T11:00:00.000Z", panelistUserIds: [7] },
    user: { id: 1 },
    ...overrides,
  } as any;
}

beforeEach(() => {
  candidateApplicationFindUnique.mockReset();
  vacancyStageFindUnique.mockReset();
  vacancyStageFindFirst.mockReset();
  interviewFindFirst.mockReset();
  vacancyInterviewerFindMany.mockReset();
  interviewSlotFindFirst.mockReset();
  userFindMany.mockReset();
  transactionMock.mockReset();
  sendEmailMock.mockReset().mockResolvedValue(undefined);
  writeAuditLogMock.mockReset().mockResolvedValue(undefined);
  renderTemplateMock.mockReset().mockResolvedValue({ subject: "Your interview", body: "Details" });
  notifyUserMock.mockReset().mockResolvedValue(undefined);

  candidateApplicationFindUnique.mockResolvedValue({ id: 501, candidateId: 9, vacancyId: 1, stage: "SHORTLISTED" });
  vacancyStageFindUnique.mockResolvedValue({ id: 10, vacancyId: 1, order: 1, name: "Technical Interview" });
});

describe("scheduleInterview -- candidate-side scheduling conflict (Forty-third pass)", () => {
  it("blocks with a 409 when the candidate already has another interview at the exact same time", async () => {
    interviewFindFirst.mockResolvedValue({
      application: {
        candidate: { name: "Noah Bennett" },
        vacancy: { title: "Product Designer" },
      },
    });

    const req = makeReq();
    const res = makeRes();
    await scheduleInterview(req, res);

    expect(res.statusCode).toBe(409);
    expect((res.body as { error: string }).error).toContain("Noah Bennett");
    expect((res.body as { error: string }).error).toContain("Product Designer");
    expect((res.body as { error: string }).error).toContain("Scheduling conflict");

    // Short-circuited before the panelist check or the actual create --
    // this must not silently fall through to scheduling anyway.
    expect(vacancyInterviewerFindMany).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("proceeds normally when the candidate has no conflicting interview", async () => {
    interviewFindFirst.mockResolvedValue(null);
    vacancyInterviewerFindMany.mockResolvedValue([{ vacancyId: 1, userId: 7 }]);
    interviewSlotFindFirst.mockResolvedValue(null);
    vacancyStageFindFirst.mockResolvedValue({ id: 99, vacancyId: 1, order: 5, name: "Final Interview" }); // not the round being scheduled -> management check is skipped

    const createdInterview = {
      id: 900,
      application: {
        candidate: { name: "Noah Bennett", email: "noah.bennett@example.com" },
        vacancy: { title: "Backend Engineer" },
      },
      slot: {
        scheduledAt: new Date("2026-09-15T11:00:00.000Z"),
        vacancyStage: { name: "Technical Interview", order: 1 },
        panelists: [{ user: { id: 7, name: "Ian Foster", email: "interviewer@altrium.com" } }],
      },
    };
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        interviewSlot: { create: vi.fn().mockResolvedValue({ id: 55 }) },
        interview: { create: vi.fn().mockResolvedValue(createdInterview) },
      })
    );

    const req = makeReq();
    const res = makeRes();
    await scheduleInterview(req, res);

    // Reached the actual scheduling step -- the new check didn't false-positive.
    expect(interviewFindFirst).toHaveBeenCalled();
    expect(transactionMock).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect((res.body as { id: number }).id).toBe(900);
  });
});
