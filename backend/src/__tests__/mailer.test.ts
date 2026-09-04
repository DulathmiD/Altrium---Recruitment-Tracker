import { describe, it, expect, vi, afterEach } from "vitest";

// mailer.ts has no top-level Prisma import, so no "../prisma.js" mock is
// needed here. Each test dynamically imports the module after setting env
// vars and resetting the module registry, since mailer.ts decides which
// code path to use (console-log stub vs. real nodemailer transport) from
// process.env at call time, and caches its transporter in a module-level
// variable that must not leak between tests.
const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock("nodemailer");
});

describe("sendEmail", () => {
  it("falls back to logging to the console when SMTP env vars are not set", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    vi.resetModules();

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { sendEmail } = await import("../utils/mailer.js");

    await expect(
      sendEmail({ to: "candidate@example.com", subject: "Interview scheduled", body: "See you then." })
    ).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalled();
    const loggedText = logSpy.mock.calls.flat().join("\n");
    expect(loggedText).toContain("candidate@example.com");
    expect(loggedText).toContain("Interview scheduled");
  });

  it("still falls back to console logging if only some SMTP vars are set", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    vi.resetModules();

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { sendEmail } = await import("../utils/mailer.js");

    await sendEmail({ to: "a@b.com", subject: "s", body: "b" });

    expect(logSpy).toHaveBeenCalled();
  });

  it("sends via nodemailer when SMTP is fully configured", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASS = "secret";
    process.env.MAIL_FROM = "no-reply@example.com";

    const sendMailMock = vi.fn().mockResolvedValue({ messageId: "abc" });
    const createTransportMock = vi.fn().mockReturnValue({ sendMail: sendMailMock });
    vi.doMock("nodemailer", () => ({
      default: { createTransport: createTransportMock },
      createTransport: createTransportMock,
    }));
    vi.resetModules();

    const { sendEmail } = await import("../utils/mailer.js");
    await sendEmail({ to: "candidate@example.com", subject: "Offer", body: "Congrats!" });

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp.example.com", port: 587, auth: { user: "user@example.com", pass: "secret" } })
    );
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "no-reply@example.com",
        to: "candidate@example.com",
        subject: "Offer",
        text: "Congrats!",
      })
    );
  });

  it("renders a branded HTML version alongside the plain text, without changing the text version", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASS = "secret";
    process.env.MAIL_FROM = "no-reply@example.com";

    const sendMailMock = vi.fn().mockResolvedValue({});
    const createTransportMock = vi.fn().mockReturnValue({ sendMail: sendMailMock });
    vi.doMock("nodemailer", () => ({
      default: { createTransport: createTransportMock },
      createTransport: createTransportMock,
    }));
    vi.resetModules();

    const { sendEmail } = await import("../utils/mailer.js");
    await sendEmail({
      to: "candidate@example.com",
      subject: "Your interview",
      body: "Hi Alice,\n\nSee you then.",
    });

    const call = sendMailMock.mock.calls[0]?.[0];
    expect(call.text).toBe("Hi Alice,\n\nSee you then.");
    expect(call.html).toContain("Altrium");
    expect(call.html).toContain("Hi Alice,");
    expect(call.html).toContain("<html");
  });

  it("renders a paragraph that's just a bare URL as a clickable button, not raw link text", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASS = "secret";

    const sendMailMock = vi.fn().mockResolvedValue({});
    const createTransportMock = vi.fn().mockReturnValue({ sendMail: sendMailMock });
    vi.doMock("nodemailer", () => ({
      default: { createTransport: createTransportMock },
      createTransport: createTransportMock,
    }));
    vi.resetModules();

    const { sendEmail } = await import("../utils/mailer.js");
    const resetLink = "http://localhost:5173/reset-password?token=abc123";
    await sendEmail({
      to: "user@example.com",
      subject: "Reset your password",
      body: `Hi Bobby,\n\nUse this link to reset your password:\n${resetLink}\n\nIf you didn't request this, ignore this email.`,
    });

    const html = sendMailMock.mock.calls[0]?.[0]?.html as string;
    expect(html).toContain(`href="${resetLink}"`);
    expect(html).toContain("Open link");
  });

  it("escapes HTML special characters in the body instead of injecting them raw", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASS = "secret";

    const sendMailMock = vi.fn().mockResolvedValue({});
    const createTransportMock = vi.fn().mockReturnValue({ sendMail: sendMailMock });
    vi.doMock("nodemailer", () => ({
      default: { createTransport: createTransportMock },
      createTransport: createTransportMock,
    }));
    vi.resetModules();

    const { sendEmail } = await import("../utils/mailer.js");
    await sendEmail({
      to: "user@example.com",
      subject: "Test",
      body: "Candidate name: <script>alert(1)</script> & co.",
    });

    const html = sendMailMock.mock.calls[0]?.[0]?.html as string;
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; co.");
  });

  it("reuses the same transporter across multiple sends instead of reconnecting every time", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASS = "secret";

    const sendMailMock = vi.fn().mockResolvedValue({});
    const createTransportMock = vi.fn().mockReturnValue({ sendMail: sendMailMock });
    vi.doMock("nodemailer", () => ({
      default: { createTransport: createTransportMock },
      createTransport: createTransportMock,
    }));
    vi.resetModules();

    const { sendEmail } = await import("../utils/mailer.js");
    await sendEmail({ to: "a@b.com", subject: "1", body: "1" });
    await sendEmail({ to: "c@d.com", subject: "2", body: "2" });

    expect(createTransportMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledTimes(2);
  });
});
