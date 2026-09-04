// SCRUM2-45: configurable notification templates.
//
// Scope decision (see decision log): only the emails the system sends
// automatically, with nobody reviewing/editing the wording at send time, are
// template-backed here -- interview scheduled, hiring decision, password
// reset, interview reminder. The three manual Follow-Ups sends (feedback
// reminder, manual candidate/panelist invite -- see followUp.controller.ts)
// deliberately stay HR's own free-typed text per send; that's already more
// configurable than a fixed template, not less, so folding them in here
// would be a downgrade, not an improvement.
//
// `TEMPLATE_KEYS` is a fixed, code-referenced set -- IT Admin can edit an
// existing template's subject/body, but can't add a new key from the UI,
// since a new key wouldn't have anything wired to read it.
import { prisma } from "../prisma.js";

export const TEMPLATE_KEYS = [
  "interview_scheduled_panelist",
  "interview_scheduled_candidate",
  "hiring_decision_hire",
  "hiring_decision_reject",
  "auth_password_reset",
  "interview_reminder_panelist",
  "interview_reminder_candidate",
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

// Human-readable label + the placeholder names available to each template,
// shown to IT Admin on the editor screen so they know what {{...}} tokens
// they can use without having to read the source that fills them in.
export const TEMPLATE_META: Record<TemplateKey, { label: string; placeholders: string[] }> = {
  interview_scheduled_panelist: {
    label: "Interview scheduled - panelist notice",
    placeholders: ["panelistName", "candidateName", "vacancyTitle", "stageLabel", "when", "cvUrl"],
  },
  interview_scheduled_candidate: {
    label: "Interview scheduled - candidate notice",
    placeholders: ["candidateName", "vacancyTitle", "stageLabel", "when"],
  },
  hiring_decision_hire: {
    label: "Hiring decision - offer",
    placeholders: ["candidateName", "vacancyTitle"],
  },
  hiring_decision_reject: {
    label: "Hiring decision - rejection",
    placeholders: ["candidateName", "vacancyTitle"],
  },
  auth_password_reset: {
    label: "Password reset link",
    placeholders: ["userName", "resetLink"],
  },
  interview_reminder_panelist: {
    label: "Interview reminder - panelist (SCRUM2-29)",
    placeholders: ["panelistName", "candidateName", "vacancyTitle", "stageLabel", "when", "cvUrl"],
  },
  interview_reminder_candidate: {
    label: "Interview reminder - candidate (SCRUM2-29)",
    placeholders: ["candidateName", "vacancyTitle", "stageLabel", "when"],
  },
};

// The exact original hardcoded strings from each call site, just with
// template-literal interpolation swapped for {{placeholder}} tokens. These
// are also what gets seeded into NotificationTemplate on first setup (see
// backend/scripts/seed-notification-templates.ts) -- so until IT Admin
// changes anything, behavior is byte-for-byte identical to before this
// feature existed.
export const DEFAULT_TEMPLATES: Record<TemplateKey, { subject: string; body: string }> = {
  interview_scheduled_panelist: {
    subject: "Interview scheduled: {{candidateName}} for {{vacancyTitle}}",
    body:
      "Hi {{panelistName}},\n\nYou've been assigned to interview {{candidateName}} for the {{vacancyTitle}} role ({{stageLabel}} stage).\n\nScheduled for: {{when}}\n\nCandidate CV: {{cvUrl}}",
  },
  interview_scheduled_candidate: {
    subject: "Your interview for {{vacancyTitle}} at Altrium",
    body:
      "Hi {{candidateName}},\n\nYour {{stageLabel}} interview for the {{vacancyTitle}} role has been scheduled.\n\nDate/time: {{when}}\n\nWe'll be in touch with further details. If you have any questions, reply to this email.",
  },
  hiring_decision_hire: {
    subject: "Congratulations - offer for {{vacancyTitle}} at Altrium",
    body:
      "Hi {{candidateName}},\n\nWe're pleased to let you know you've been selected for the {{vacancyTitle}} role at Altrium. Our HR team will be in touch shortly with next steps and offer details.\n\nCongratulations!",
  },
  hiring_decision_reject: {
    subject: "Update on your application for {{vacancyTitle}} at Altrium",
    body:
      "Hi {{candidateName}},\n\nThank you for taking the time to interview for the {{vacancyTitle}} role at Altrium. After careful consideration, we've decided to move forward with another candidate.\n\nWe appreciate your interest in Altrium and encourage you to apply for future openings that match your experience.",
  },
  auth_password_reset: {
    subject: "Reset your Recruitment Tracker password",
    body:
      "Hi {{userName}},\n\nUse this link to reset your password (expires in 1 hour):\n{{resetLink}}\n\nIf you didn't request this, you can ignore this email.",
  },
  interview_reminder_panelist: {
    subject: "Reminder: upcoming interview for {{vacancyTitle}}",
    body:
      "Hi {{panelistName}},\n\nThis is a reminder that you're interviewing {{candidateName}} for the {{vacancyTitle}} role ({{stageLabel}} stage).\n\nScheduled for: {{when}}\n\nCandidate CV: {{cvUrl}}",
  },
  interview_reminder_candidate: {
    subject: "Reminder: your upcoming interview for {{vacancyTitle}} at Altrium",
    body:
      "Hi {{candidateName}},\n\nThis is a friendly reminder that your {{stageLabel}} interview for the {{vacancyTitle}} role is coming up.\n\nDate/time: {{when}}\n\nWe look forward to speaking with you.",
  },
};

function substitute(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    const value = vars[name];
    return value !== undefined ? value : match;
  });
}

// Looks up the DB-stored template for `key`; falls back to the hardcoded
// default if IT Admin hasn't seeded/edited it yet (or the seed script was
// never run) -- a missing row must never break a real send.
export async function renderTemplate(
  key: TemplateKey,
  vars: Record<string, string>
): Promise<{ subject: string; body: string }> {
  let subject: string = DEFAULT_TEMPLATES[key].subject;
  let body: string = DEFAULT_TEMPLATES[key].body;

  try {
    const row = await prisma.notificationTemplate.findUnique({ where: { key } });
    if (row) {
      subject = row.subject;
      body = row.body;
    }
  } catch (err) {
    // A DB hiccup here must not block the underlying email -- fall back to
    // the hardcoded default exactly as if no row existed.
    console.error(`Could not load notification template "${key}", using default:`, err);
  }

  return { subject: substitute(subject, vars), body: substitute(body, vars) };
}
