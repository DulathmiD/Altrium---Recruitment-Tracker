import { apiFetch } from "./client";
import type { VacancyStatus } from "./vacancy";

// US-26/US-29, locked interpretation -- see decision log. Both lists are
// derived server-side on every call, nothing is stored as "pending".

export type PendingCvReview = {
  applicationId: number;
  candidate: { id: number; name: string; email: string };
  vacancy: { id: number; title: string; department: string };
  appliedAt: string;
};

export type PendingFeedbackRow = {
  interviewId: number;
  scheduledAt: string;
  candidate: { id: number; name: string };
  vacancy: { id: number; title: string; status: VacancyStatus };
  round: { id: number; name: string; order: number; roundLabel: string | null };
  pendingFrom: { id: number; name: string; email: string }[];
};

export type PendingInviteRow = {
  interviewId: number;
  scheduledAt: string;
  candidate: { id: number; name: string; email: string };
  vacancy: { id: number; title: string };
  round: { id: number; name: string; order: number; roundLabel: string | null };
};

export type PendingPanelistInviteRow = {
  interviewId: number;
  scheduledAt: string;
  candidate: { id: number; name: string };
  vacancy: { id: number; title: string };
  round: { id: number; name: string; order: number; roundLabel: string | null };
  pendingFrom: { id: number; name: string; email: string }[];
};

export type UpcomingCallRow = {
  interviewId: number;
  scheduledAt: string;
  candidate: { id: number; name: string; phoneNumber: string | null };
  vacancy: { id: number; title: string };
  round: { id: number; name: string; order: number };
};

export type FollowUps = {
  pendingCvReviews: PendingCvReview[];
  pendingFeedback: PendingFeedbackRow[];
  pendingInvites: PendingInviteRow[];
  pendingPanelistInvites: PendingPanelistInviteRow[];
  upcomingCalls: UpcomingCallRow[];
};

export function listFollowUps() {
  return apiFetch<FollowUps>("/follow-ups");
}

// The "fixed template, editable before send" flow lives entirely on this
// side -- buildReminderTemplate() below produces the default text, the
// component lets HR edit it, and this just sends whatever the final text is.
export function sendFeedbackReminder(interviewId: number, userId: number, input: { subject: string; message: string }) {
  return apiFetch<{ sent: boolean }>(`/interviews/${interviewId}/panelists/${userId}/remind`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function buildReminderTemplate(row: PendingFeedbackRow, panelistName: string): { subject: string; message: string } {
  const when = new Date(row.scheduledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return {
    subject: `Reminder: interview feedback needed - ${row.candidate.name} (${row.vacancy.title})`,
    message: `Hi ${panelistName},\n\nJust a reminder that we're still waiting on your feedback for ${row.candidate.name}'s ${row.round.name} interview for the ${row.vacancy.title} role, held on ${when}.\n\nPlease submit it when you get a chance.\n\nThanks,\nAltrium HR`,
  };
}

// Manual counterpart to the round-1 auto-invite (see decision log) -- HR
// sends this by hand for round 2+ interviews from the "Interview Invites"
// Follow Ups section.
export function sendCandidateInvite(interviewId: number, input: { subject: string; message: string }) {
  return apiFetch<{ sent: boolean }>(`/interviews/${interviewId}/candidate/remind`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function buildInviteTemplate(row: PendingInviteRow): { subject: string; message: string } {
  const when = new Date(row.scheduledAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const roundText = row.round.roundLabel ? `${row.round.name} (${row.round.roundLabel})` : row.round.name;
  return {
    subject: `Your interview for ${row.vacancy.title} at Altrium`,
    message: `Hi ${row.candidate.name},\n\nYour ${roundText} interview for the ${row.vacancy.title} role has been scheduled.\n\nDate/time: ${when}\n\nWe'll be in touch with further details. If you have any questions, reply to this email.`,
  };
}

// Manual counterpart to the round-1 auto-notify for a single panelist (see
// decision log) -- HR sends this by hand for round 2+ interviews from the
// "Interview Invites - Interviewers" Follow Ups section.
export function sendPanelistInterviewInvite(interviewId: number, userId: number, input: { subject: string; message: string }) {
  return apiFetch<{ sent: boolean }>(`/interviews/${interviewId}/panelists/${userId}/invite`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function buildPanelistInviteTemplate(row: PendingPanelistInviteRow, panelistName: string): { subject: string; message: string } {
  const when = new Date(row.scheduledAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const roundText = row.round.roundLabel ? `${row.round.name} (${row.round.roundLabel})` : row.round.name;
  return {
    subject: `Interview scheduled: ${row.candidate.name} for ${row.vacancy.title}`,
    message: `Hi ${panelistName},\n\nYou've been assigned to interview ${row.candidate.name} for the ${row.vacancy.title} role (${roundText} stage).\n\nScheduled for: ${when}`,
  };
}
