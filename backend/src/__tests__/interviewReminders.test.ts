import { describe, it, expect, vi, beforeEach } from "vitest";

// runInterviewReminderCheck() touches five modules -- mock every one of
// them individually (rather than a blanket prisma Proxy like
// auditLog.test.ts uses) since this test actually needs to control what
// each returns and assert on how each is called, not just satisfy imports.
const findManyMock = vi.fn();
const updateMock = vi.fn();
vi.mock("../prisma.js", () => ({
  prisma: {
    interviewSlot: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

const sendEmailMock = vi.fn();
vi.mock("../utils/mailer.js", () => ({ sendEmail: (...args: unknown[]) => sendEmailMock(...args) }));

const writeAuditLogMock = vi.fn();
vi.mock("../utils/auditLog.js", () => ({ writeAuditLog: (...args: unknown[]) => writeAuditLogMock(...args) }));

const notifyUserMock = vi.fn();
vi.mock("../utils/notify.js", () => ({ notifyUser: (...args: unknown[]) => notifyUserMock(...args) }));

const renderTemplateMock = vi.fn();
vi.mock("../utils/notificationTemplates.js", () => ({
  renderTemplate: (...args: unknown[]) => renderTemplateMock(...args),
}));

const { runInterviewReminderCheck } = await import("../jobs/interviewReminders.js");

function makeSlot(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    scheduledAt: new Date("2026-09-02T10:00:00Z"),
    reminderSentAt: null,
    vacancyStage: { name: "Technical" },
    panelists: [{ userId: 1, user: { id: 1, name: "Pat Panelist", email: "pat@example.com" } }],
    interviews: [
      {
        application: {
          vacancy: { title: "Backend Engineer" },
          candidate: { name: "Alice", email: "alice@example.com", cvUrl: "http://cv/alice.pdf" },
        },
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  findManyMock.mockReset();
  updateMock.mockReset().mockResolvedValue(undefined);
  sendEmailMock.mockReset().mockResolvedValue(undefined);
  writeAuditLogMock.mockReset().mockResolvedValue(undefined);
  notifyUserMock.mockReset().mockResolvedValue(undefined);
  renderTemplateMock.mockReset().mockResolvedValue({ subject: "Reminder", body: "Body" });
});

describe("runInterviewReminderCheck", () => {
  it("only queries slots within the reminder window that haven't already been reminded", async () => {
    findManyMock.mockResolvedValue([]);

    await runInterviewReminderCheck();

    const call = findManyMock.mock.calls[0]?.[0];
    expect(call.where.reminderSentAt).toBeNull();
    expect(call.where.scheduledAt.gte).toBeInstanceOf(Date);
    expect(call.where.scheduledAt.lte).toBeInstanceOf(Date);
  });

  it("emails every panelist and every candidate on a qualifying slot, and marks it reminded", async () => {
    findManyMock.mockResolvedValue([makeSlot()]);

    await runInterviewReminderCheck();

    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "pat@example.com" }));
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "alice@example.com" }));
    expect(notifyUserMock).toHaveBeenCalledWith(1, "interview_reminder_panelist", expect.any(String));
    expect(updateMock).toHaveBeenCalledWith({ where: { id: 42 }, data: { reminderSentAt: expect.any(Date) } });
  });

  it("audit-logs both the panelist and candidate reminder sends", async () => {
    findManyMock.mockResolvedValue([makeSlot()]);

    await runInterviewReminderCheck();

    expect(writeAuditLogMock).toHaveBeenCalledWith(
      1,
      "NOTIFICATION_SENT",
      "InterviewSlot",
      42,
      expect.objectContaining({ recipient: "pat@example.com", reason: "interview_reminder_panelist" })
    );
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      1,
      "NOTIFICATION_SENT",
      "InterviewSlot",
      42,
      expect.objectContaining({ recipient: "alice@example.com", reason: "interview_reminder_candidate" })
    );
  });

  it("skips a slot with no candidates yet -- no emails sent, and reminderSentAt left null so it can still be picked up later", async () => {
    findManyMock.mockResolvedValue([makeSlot({ interviews: [] })]);

    await runInterviewReminderCheck();

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("sends one combined reminder per panelist even when multiple candidates share the same slot, not one per candidate", async () => {
    const slot = makeSlot({
      interviews: [
        {
          application: {
            vacancy: { title: "Backend Engineer" },
            candidate: { name: "Alice", email: "alice@example.com", cvUrl: "http://cv/alice.pdf" },
          },
        },
        {
          application: {
            vacancy: { title: "Backend Engineer" },
            candidate: { name: "Ben", email: "ben@example.com", cvUrl: "http://cv/ben.pdf" },
          },
        },
      ],
    });
    findManyMock.mockResolvedValue([slot]);

    await runInterviewReminderCheck();

    const panelistSends = sendEmailMock.mock.calls.filter((c) => c[0].to === "pat@example.com");
    expect(panelistSends).toHaveLength(1);
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "alice@example.com" }));
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "ben@example.com" }));
  });

  it("still marks the slot reminded and continues to the next recipient even if one email send fails", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error("SMTP down")).mockResolvedValue(undefined);
    findManyMock.mockResolvedValue([makeSlot()]);

    await expect(runInterviewReminderCheck()).resolves.toBeUndefined();

    // Candidate email should still have been attempted despite the
    // panelist's send failing first.
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "alice@example.com" }));
    expect(updateMock).toHaveBeenCalledWith({ where: { id: 42 }, data: { reminderSentAt: expect.any(Date) } });
  });

  it("does not blow up the whole check if the initial query itself fails", async () => {
    findManyMock.mockRejectedValue(new Error("DB connection lost"));

    await expect(runInterviewReminderCheck()).resolves.toBeUndefined();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
