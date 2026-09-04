import { prisma } from "../prisma.js";

// Single choke point for writing to the generic AuditLog table (US-21/US-43).
// Every controller that needs to log a new-style event calls this instead of
// calling prisma.auditLog.create() directly -- same reasoning as
// transitionApplicationStage() being the one place stage history gets written,
// so a future event type can't accidentally skip logging by writing an
// ad-hoc insert somewhere else.
//
// Does NOT cover stage transitions (ApplicationStageHistory) or feedback edits
// (FeedbackAuditLog) -- those keep their own dedicated write paths.
export type AuditAction =
  | "VACANCY_CREATED"
  | "VACANCY_EDITED"
  | "VACANCY_CLOSED"
  | "CV_UPLOADED"
  | "FEEDBACK_SUBMITTED"
  | "INTERVIEW_SCHEDULED"
  | "NOTIFICATION_SENT"
  | "ACCOUNT_CREATED"
  | "ACCOUNT_DEACTIVATED"
  | "ROLE_CHANGED"
  | "HM_DECISION_COMMENT"
  | "NOTIFICATION_TEMPLATE_UPDATED";

export async function writeAuditLog(
  userId: number,
  action: AuditAction,
  entityType: string,
  entityId: number | null,
  metadata?: Record<string, unknown>
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      ...(metadata !== undefined ? { metadata: metadata as object } : {}),
    },
  });
}
