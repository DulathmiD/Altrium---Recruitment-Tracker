import { apiFetch } from "./client";
import type { VacancyStageSummary } from "./candidates";

export type Interview = {
  id: number;
  applicationId: number;
  vacancyStageId: number;
  scheduledAt: string;
  createdAt: string;
  vacancyStage: VacancyStageSummary;
  panelists: {
    id: number;
    userId: number;
    user: { id: number; name: string; email: string };
  }[];
};

// My Interviews (Interviewer wireframe): same base Interview shape plus the
// application/candidate/vacancy context the table needs, and whether this
// panelist (not anyone else on the panel) has already submitted feedback --
// added server-side in listMyInterviews, not part of the literal wireframe
// but needed to know whether a row's Feedback screen opens in create or edit
// mode before the user clicks in.
export type MyInterview = Interview & {
  application: {
    id: number;
    candidate: { id: number; name: string; email: string };
    vacancy: { id: number; title: string; department: string };
  };
  feedbackSubmitted: boolean;
  feedbackSubmittedAt: string | null;
};

export function listInterviewsForApplication(applicationId: number) {
  return apiFetch<Interview[]>(`/applications/${applicationId}/interviews`);
}

export function listMyInterviews() {
  return apiFetch<MyInterview[]>("/interviews/mine");
}

export type InterviewDetail = Interview & {
  application: {
    id: number;
    candidate: { id: number; name: string; email: string };
    vacancy: { id: number; title: string; department: string };
  };
};

export function getInterview(id: number) {
  return apiFetch<InterviewDetail>(`/interviews/${id}`);
}

export function scheduleInterview(
  applicationId: number,
  input: { vacancyStageId: number; scheduledAt: string; panelistUserIds: number[] }
) {
  return apiFetch<Interview>(`/applications/${applicationId}/interviews`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// --- HR Interviews calendar module ---
// Frontend-corrections pass: schema split Interview into InterviewSlot (the
// calendar entry -- time/round/panel/HR's optional round label) + Interview
// (one candidate's participation). See docs/project-decisions-log.md. These
// slot-level types/calls are the new primitives the calendar page is built
// on top of, separate from the per-candidate Interview shape above (which
// CandidatesPage's quick single-candidate schedule flow still uses
// unchanged).

export type InterviewSlotSummary = {
  id: number;
  scheduledAt: string;
  roundLabel: string | null;
  vacancyStage: VacancyStageSummary & { vacancy: { id: number; title: string; department: string } };
  panelists: { id: number; userId: number; user: { id: number; name: string; email: string } }[];
  candidateCount: number;
};

// Auto-names a slot per the wireframe: "Vacancy - Stage - Round" (round
// omitted if HR didn't type one), e.g. "Software Engineer - Technical
// Interview - Round 02".
export function interviewSlotLabel(slot: InterviewSlotSummary): string {
  const base = `${slot.vacancyStage.vacancy.title} - ${slot.vacancyStage.name}`;
  return slot.roundLabel ? `${base} - ${slot.roundLabel}` : base;
}

export function listInterviewSlots(range?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (range?.from) params.set("from", range.from);
  if (range?.to) params.set("to", range.to);
  const qs = params.toString();
  return apiFetch<InterviewSlotSummary[]>(`/interviews${qs ? `?${qs}` : ""}`);
}

export function createInterviewSlotOnly(input: {
  vacancyStageId: number;
  scheduledAt: string;
  panelistUserIds: number[];
  roundLabel?: string;
}) {
  return apiFetch<InterviewSlotSummary>("/interviews", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type InterviewSlotDetail = InterviewSlotSummary & {
  interviews: {
    id: number;
    applicationId: number;
    application: {
      id: number;
      candidate: { id: number; name: string; email: string };
    };
    feedback: { id: number; interviewerId: number }[];
  }[];
};

export function getInterviewSlotDetail(slotId: number) {
  return apiFetch<InterviewSlotDetail>(`/interviews/slots/${slotId}`);
}

export type AddCandidatesResult = {
  added: number[];
  failed: { applicationId: number; error: string }[];
};

export function addCandidatesToInterviewSlot(slotId: number, applicationIds: number[]) {
  return apiFetch<AddCandidatesResult>(`/interviews/${slotId}/candidates`, {
    method: "POST",
    body: JSON.stringify({ applicationIds }),
  });
}
