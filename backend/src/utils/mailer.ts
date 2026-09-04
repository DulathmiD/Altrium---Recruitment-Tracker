// Real email delivery via SMTP (works with Outlook/Microsoft 365, Gmail, or
// any other SMTP provider), configured entirely from environment variables.
// If those variables aren't set -- e.g. a teammate's machine that hasn't
// configured a mail account yet -- this transparently falls back to the
// original dev behavior of logging the email to the console instead of
// sending it, so the rest of the app keeps working without a mail account.
//
// Required env vars for real sending (see backend/.env.example):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
// Optional:
//   SMTP_SECURE ("true" for port 465, omit/"false" for STARTTLS on 587)
import nodemailer, { type Transporter } from "nodemailer";

type EmailInput = {
  to: string;
  subject: string;
  body: string;
};

// Every automated send (interview scheduled, hiring decision, password
// reset, interview reminder) is authored as plain text -- that's what IT
// Admin edits on the Notification Templates screen, and it's what the dev
// console fallback below prints. Real mail clients deserve better than raw
// text though, so this wraps that same text in a simple branded HTML layout
// at send time only. The template text itself never changes -- this is a
// presentation step, not a content one.
const GOLD = "#f5a623";
const INK = "#1f2937";
const INK_SOFT = "#6b7280";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BARE_URL_RE = /^https?:\/\/\S+$/;
const INLINE_URL_RE = /https?:\/\/[^\s<]+/g;

function linkify(escapedText: string): string {
  return escapedText.replace(
    INLINE_URL_RE,
    (url) => `<a href="${url}" style="color:#b45309;font-weight:600;">${url}</a>`
  );
}

function buttonBlock(rawUrl: string): string {
  const url = escapeHtml(rawUrl);
  return `<p style="margin:20px 0;text-align:center;"><a href="${url}" style="background:${GOLD};color:#1a1200;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:999px;display:inline-block;">Open link</a></p>`;
}

function textBlock(lines: string[]): string {
  return `<p style="margin:0 0 16px;color:${INK};font-size:14px;line-height:1.6;">${lines.join("<br>")}</p>`;
}

// Real templates put a link on its own line but in the SAME paragraph as its
// lead-in sentence (no blank line between them -- see auth_password_reset's
// "Use this link ...:\n{{resetLink}}"), so checking whether an entire
// paragraph is nothing but a URL would never match any real template. This
// checks line-by-line within each paragraph instead: a line that's nothing
// but a URL becomes its own centered button, breaking the surrounding text
// into separate <p> blocks around it; any URL still embedded mid-sentence
// (e.g. "Candidate CV: {{cvUrl}}") is left as a normal inline link, since
// there's no clean way to button-ify a fragment of a sentence.
function renderParagraph(paragraph: string): string {
  const lines = paragraph.split("\n");
  const blocks: string[] = [];
  let pendingTextLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (BARE_URL_RE.test(trimmed)) {
      if (pendingTextLines.length > 0) {
        blocks.push(textBlock(pendingTextLines));
        pendingTextLines = [];
      }
      blocks.push(buttonBlock(trimmed));
    } else {
      pendingTextLines.push(linkify(escapeHtml(line)));
    }
  }
  if (pendingTextLines.length > 0) {
    blocks.push(textBlock(pendingTextLines));
  }
  return blocks.join("\n");
}

function renderEmailHtml(body: string): string {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const paragraphHtml = paragraphs.map(renderParagraph).join("\n");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f3ef;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3ef;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:#111111;padding:20px 28px;border-top:4px solid ${GOLD};">
                <span style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:0.02em;">Altrium</span>
                <span style="color:${GOLD};font-size:16px;font-weight:700;"> Recruitment Tracker</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                ${paragraphHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;border-top:1px solid #e5e7eb;">
                <p style="margin:0;color:${INK_SOFT};font-size:11.5px;line-height:1.5;">This is an automated message from Altrium Recruitment Tracker. Please don't reply directly to this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function isConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return cachedTransporter;
}

export async function sendEmail({ to, subject, body }: EmailInput): Promise<void> {
  if (!isConfigured()) {
    console.log("\n===== DEV EMAIL (SMTP not configured, not actually sent) =====");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(body);
    console.log("================================================================\n");
    return;
  }

  // A real send can fail for reasons outside our control (bad credentials,
  // provider rate limits, network blip). Every call site already treats a
  // thrown error from sendEmail() as "notification failed, but the
  // underlying action (decision recorded / interview scheduled / etc.)
  // still succeeded" -- so we let it throw and let the caller decide how to
  // handle/report that, exactly like it did before this file could fail.
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text: body,
    html: renderEmailHtml(body),
  });
}
