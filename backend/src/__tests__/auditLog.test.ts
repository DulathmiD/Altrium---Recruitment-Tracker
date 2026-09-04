import { describe, it, expect, vi } from "vitest";

// See feedback.test.ts for why this mock is needed even for pure-function tests.
vi.mock("../prisma.js", () => {
  const handler: ProxyHandler<object> = {
    get: (_t, prop) => (prop === "then" ? undefined : new Proxy(() => Promise.resolve(undefined), handler)),
  };
  return { prisma: new Proxy({}, handler) };
});

const { describeAction, EVENT_TYPE } = await import("../controllers/auditLog.controller.js");

describe("EVENT_TYPE categorization", () => {
  it("groups every AuditAction into one of the wireframe's Event Type categories", () => {
    expect(EVENT_TYPE.VACANCY_CREATED).toBe("Vacancy Management");
    expect(EVENT_TYPE.NOTIFICATION_SENT).toBe("Notifications");
    expect(EVENT_TYPE.ACCOUNT_CREATED).toBe("User Management");
    expect(EVENT_TYPE.ACCOUNT_DEACTIVATED).toBe("User Management");
    expect(EVENT_TYPE.ROLE_CHANGED).toBe("User Management");
    expect(EVENT_TYPE.HM_DECISION_COMMENT).toBe("Hiring Decisions");
  });
});

describe("describeAction", () => {
  it("builds a specific, name-carrying sentence when metadata has the expected fields", () => {
    expect(describeAction("VACANCY_CREATED", { title: "Backend Engineer" })).toBe(
      "Created vacancy: Backend Engineer"
    );
    expect(describeAction("CV_UPLOADED", { name: "Alice Mensah" })).toBe("Uploaded a CV for Alice Mensah");
    expect(describeAction("NOTIFICATION_SENT", { recipient: "alice@example.com" })).toBe(
      "Sent a notification to alice@example.com"
    );
    expect(describeAction("ROLE_CHANGED", { name: "Bob", newRole: "HR" })).toBe("Changed Bob's role to HR");
  });

  it("falls back gracefully when metadata is missing fields (older log rows)", () => {
    expect(describeAction("VACANCY_CREATED", {})).toBe("Created vacancy: Untitled vacancy");
    expect(describeAction("CV_UPLOADED", undefined)).toBe("Uploaded a CV for a candidate");
    expect(describeAction("NOTIFICATION_SENT", null)).toBe("Sent a notification to a recipient");
  });

  it("falls back to the raw action string for anything unrecognized", () => {
    expect(describeAction("SOME_FUTURE_ACTION", {})).toBe("SOME_FUTURE_ACTION");
  });
});
