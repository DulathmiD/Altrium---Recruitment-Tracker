import { describe, it, expect, vi, beforeEach } from "vitest";

// renderTemplate() reads from prisma.notificationTemplate -- mock just that
// one method so each test controls exactly what "the DB" returns, same
// targeted-mock approach as feedback.test.ts/auditLog.test.ts use for the
// parts of prisma they actually touch.
const findUniqueMock = vi.fn();
vi.mock("../prisma.js", () => ({
  prisma: { notificationTemplate: { findUnique: (...args: unknown[]) => findUniqueMock(...args) } },
}));

const { renderTemplate, TEMPLATE_KEYS, TEMPLATE_META, DEFAULT_TEMPLATES } = await import(
  "../utils/notificationTemplates.js"
);

beforeEach(() => {
  findUniqueMock.mockReset();
});

describe("renderTemplate", () => {
  it("substitutes every {{placeholder}} using the hardcoded default when no DB row exists", async () => {
    findUniqueMock.mockResolvedValue(null);

    const { subject, body } = await renderTemplate("auth_password_reset", {
      userName: "Bobby",
      resetLink: "http://localhost:5173/reset-password?token=abc123",
    });

    expect(subject).toBe(DEFAULT_TEMPLATES.auth_password_reset.subject);
    expect(body).toContain("Hi Bobby,");
    expect(body).toContain("http://localhost:5173/reset-password?token=abc123");
    expect(body).not.toContain("{{");
  });

  it("uses the IT-Admin-edited subject/body from the DB when a row exists, instead of the default", async () => {
    findUniqueMock.mockResolvedValue({
      subject: "Custom subject for {{userName}}",
      body: "Custom body with a link: {{resetLink}}",
    });

    const { subject, body } = await renderTemplate("auth_password_reset", {
      userName: "Bobby",
      resetLink: "http://example.com/reset",
    });

    expect(subject).toBe("Custom subject for Bobby");
    expect(body).toBe("Custom body with a link: http://example.com/reset");
  });

  it("leaves an unrecognized {{placeholder}} untouched instead of blanking it out", async () => {
    findUniqueMock.mockResolvedValue(null);

    const { body } = await renderTemplate("auth_password_reset", { userName: "Bobby" });

    // resetLink was never supplied -- substitute() must leave the literal
    // token in place (a blank/undefined string would be worse: a reset
    // email with no link at all, silently).
    expect(body).toContain("{{resetLink}}");
  });

  it("falls back to the default template if the DB lookup throws, instead of failing the send", async () => {
    findUniqueMock.mockRejectedValue(new Error("DB connection hiccup"));

    const { subject, body } = await renderTemplate("auth_password_reset", {
      userName: "Bobby",
      resetLink: "http://example.com/reset",
    });

    expect(subject).toBe(DEFAULT_TEMPLATES.auth_password_reset.subject);
    expect(body).toContain("Hi Bobby,");
  });

  it("substitutes multiple distinct placeholders in one template", async () => {
    findUniqueMock.mockResolvedValue(null);

    const { subject, body } = await renderTemplate("interview_scheduled_candidate", {
      candidateName: "Alice",
      vacancyTitle: "Backend Engineer",
      stageLabel: "Technical",
      when: "12 Sep 2026, 10:00 AM",
    });

    expect(subject).toBe("Your interview for Backend Engineer at Altrium");
    expect(body).toContain("Hi Alice,");
    expect(body).toContain("Technical interview for the Backend Engineer role");
    expect(body).toContain("12 Sep 2026, 10:00 AM");
  });
});

describe("TEMPLATE_META", () => {
  it("has a non-empty label and a placeholders array for every key in TEMPLATE_KEYS", () => {
    for (const key of TEMPLATE_KEYS) {
      expect(TEMPLATE_META[key]).toBeDefined();
      expect(TEMPLATE_META[key].label.length).toBeGreaterThan(0);
      expect(Array.isArray(TEMPLATE_META[key].placeholders)).toBe(true);
      expect(TEMPLATE_META[key].placeholders.length).toBeGreaterThan(0);
    }
  });

  it("has a matching DEFAULT_TEMPLATES entry for every key (nothing can render with no default)", () => {
    for (const key of TEMPLATE_KEYS) {
      expect(DEFAULT_TEMPLATES[key]).toBeDefined();
      expect(DEFAULT_TEMPLATES[key].subject.length).toBeGreaterThan(0);
      expect(DEFAULT_TEMPLATES[key].body.length).toBeGreaterThan(0);
    }
  });

  it("every placeholder listed in TEMPLATE_META actually appears in that template's default subject/body", () => {
    // Guards against the two lists drifting apart -- e.g. someone renames a
    // {{placeholder}} in DEFAULT_TEMPLATES without updating the "here's what
    // you can use" hint IT Admin sees on the editor screen.
    for (const key of TEMPLATE_KEYS) {
      const { subject, body } = DEFAULT_TEMPLATES[key];
      const combined = subject + body;
      for (const placeholder of TEMPLATE_META[key].placeholders) {
        expect(combined).toContain(`{{${placeholder}}}`);
      }
    }
  });
});
