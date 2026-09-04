import type { Request, Response } from "express";
import { prisma } from "../prisma.js";
import type { AuditAction } from "../utils/auditLog.js";

// IT_ADMIN only (US-21/US-43: logs accessible only to authorized IT staff).
// This is a minimal read endpoint over the generic AuditLog table only --
// it does NOT merge in ApplicationStageHistory or FeedbackAuditLog. Building
// that merged view is separate, still-open work (see decision log: the
// three-table merge/pagination question hasn't been designed yet).

// Groups the raw AuditAction values into the handful of categories the
// corrections-doc wireframe shows in an "Event Type" column/filter. This is
// a display-only grouping -- it doesn't change what gets written, only how
// it's presented and filtered here.
export const EVENT_TYPE: Record<AuditAction, string> = {
  VACANCY_CREATED: "Vacancy Management",
  VACANCY_EDITED: "Vacancy Management",
  VACANCY_CLOSED: "Vacancy Management",
  CV_UPLOADED: "Candidate Management",
  FEEDBACK_SUBMITTED: "Record Feedback",
  INTERVIEW_SCHEDULED: "Interview Management",
  NOTIFICATION_SENT: "Notifications",
  ACCOUNT_CREATED: "User Management",
  ACCOUNT_DEACTIVATED: "User Management",
  ROLE_CHANGED: "User Management",
  HM_DECISION_COMMENT: "Hiring Decisions",
  NOTIFICATION_TEMPLATE_UPDATED: "Notifications",
};

const EVENT_TYPES = [...new Set(Object.values(EVENT_TYPE))];

// Builds the specific, name-carrying sentence the wireframe asks for
// ("Submitted feedback for Amanda Silva") instead of a generic category
// label. Falls back gracefully if a metadata field is missing -- older log
// rows written before a given field existed still render something sane.
export function describeAction(action: string, metadata: unknown): string {
  const m = (metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v : fallback);

  switch (action) {
    case "VACANCY_CREATED":
      return `Created vacancy: ${str(m.title, "Untitled vacancy")}`;
    case "VACANCY_EDITED":
      return `Edited vacancy: ${str(m.title, "Untitled vacancy")}`;
    case "VACANCY_CLOSED":
      return `Closed vacancy: ${str(m.title, "Untitled vacancy")}`;
    case "CV_UPLOADED":
      return `Uploaded a CV for ${str(m.name, str(m.email, "a candidate"))}`;
    case "FEEDBACK_SUBMITTED":
      return `Submitted feedback for ${str(m.candidateName, "a candidate")}`;
    case "INTERVIEW_SCHEDULED":
      return `Scheduled an interview${typeof m.round === "string" && m.round ? ` (${m.round})` : ""}`;
    case "NOTIFICATION_SENT":
      return `Sent a notification to ${str(m.recipient, "a recipient")}`;
    case "ACCOUNT_CREATED":
      return `Created an account for ${str(m.name, str(m.email, "a user"))}`;
    case "ACCOUNT_DEACTIVATED":
      return `Deactivated the account for ${str(m.name, str(m.email, "a user"))}`;
    case "ROLE_CHANGED":
      return `Changed ${str(m.name, str(m.email, "a user"))}'s role to ${str(m.newRole, "a new role")}`;
    case "HM_DECISION_COMMENT":
      return `Left a ${String(m.decision ?? "").toLowerCase() || "hiring"} decision comment`;
    case "NOTIFICATION_TEMPLATE_UPDATED":
      return m.reset
        ? `Reset the "${str(m.key, "a")}" notification template to default`
        : `Edited the "${str(m.key, "a")}" notification template`;
    default:
      return action;
  }
}

export async function listAuditLogs(req: Request, res: Response) {
  const { eventType, from, to } = req.query as {
    eventType?: string;
    from?: string;
    to?: string;
  };

  const where: any = {};
  if (eventType && EVENT_TYPES.includes(eventType)) {
    const actionsInType = (Object.keys(EVENT_TYPE) as AuditAction[]).filter((a) => EVENT_TYPE[a] === eventType);
    where.action = { in: actionsInType };
  }
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  try {
    const logs = await prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      },
      // `id` as a secondary key breaks ties on `createdAt` -- it's DATETIME(3)
      // (millisecond precision), and two audit writes from the same request
      // sequence (e.g. two PATCH /vacancies/:id calls back-to-back) can land
      // in the same millisecond under fast local load. `createdAt` alone
      // isn't a stable sort key in that case, and since this is also the
      // tiebreaker for what falls inside/outside the `take: 200` cutoff, a
      // tie could occasionally push a just-written entry out of the window.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 200,
    });

    res.json(
      logs.map((log) => ({
        id: log.id,
        createdAt: log.createdAt,
        user: log.user,
        eventType: EVENT_TYPE[log.action as AuditAction] ?? "Other",
        description: describeAction(log.action, log.metadata),
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch audit logs" });
  }
}

export async function listAuditEventTypes(_req: Request, res: Response) {
  res.json({ eventTypes: EVENT_TYPES });
}
