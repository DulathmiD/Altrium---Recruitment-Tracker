import { apiFetch } from "./client";
import type { VacancyStatus } from "./vacancy";

export type AnchorStage = "APPLIED" | "SHORTLISTED" | "HIRED" | "REJECTED";

export type AttentionItem = {
  type: "DECISION" | "FEEDBACK" | "COMPARE";
  label: string;
  link: string | null;
};

export type HmDashboard = {
  openVacancies: number;
  awaitingMyDecision: number;
  hired: number;
  rejected: number;
  anchors: { stage: AnchorStage; label: string; candidateCount: number }[];
  rounds: { order: number; label: string; candidateCount: number }[];
  attentionItems: AttentionItem[];
};

export function getMyDashboard(filters?: { dateRange?: "30" | "90"; vacancyId?: number; department?: string }) {
  const params = new URLSearchParams();
  if (filters?.dateRange) params.set("dateRange", filters.dateRange);
  if (filters?.vacancyId) params.set("vacancyId", String(filters.vacancyId));
  if (filters?.department) params.set("department", filters.department);
  const qs = params.toString();
  return apiFetch<HmDashboard>(`/hiring-manager/dashboard${qs ? `?${qs}` : ""}`);
}

export type HmVacancy = {
  id: number;
  title: string;
  department: string;
  status: VacancyStatus;
  createdAt: string;
  targetFillDate: string | null;
  candidateCount: number;
  currentStage: string;
  // True once every candidate on this vacancy has reached HIRED/REJECTED --
  // used to sink fully-decided vacancies to the bottom of the list.
  allDecided: boolean;
};

export function getMyVacancies() {
  return apiFetch<HmVacancy[]>("/hiring-manager/vacancies");
}

// US-25: shared interview feedback visibility -- every round the application
// has been through so far, each interview's feedback attributed to the
// interviewer who gave it. Separate from `score`/`comments` below, which
// stay scoped to the current round only (locked "latest round only" scoring
// decision) -- this is about seeing the panel's feedback, not scoring.
export type FeedbackHistoryEntry = {
  round: { id: number; name: string; order: number };
  scheduledAt: string;
  entries: { interviewerId: number; interviewerName: string; score: number; comments: string }[];
};

export type PendingDecision = {
  applicationId: number;
  candidate: { id: number; name: string };
  vacancy: { id: number; title: string };
  round: { id: number; name: string; order: number };
  isFinalRound: boolean;
  score: number | null;
  commentsAvailable: boolean;
  comments: string[];
  waitingSince: string;
  feedbackHistory: FeedbackHistoryEntry[];
};

export function getMyPendingDecisions() {
  return apiFetch<PendingDecision[]>("/hiring-manager/pending-decisions");
}

// Corrections doc: new "Decision History" tab, additive to Pending
// Decisions -- every application this HM has ever decided on, bucketed
// HIRED / PROCEED (covers both Proceed and Do Not Proceed) / REJECTED, in
// that display order. A hired candidate only ever shows in the HIRED bucket.
export type DecisionHistoryEntry = {
  applicationId: number;
  candidate: { id: number; name: string };
  vacancy: { id: number; title: string };
  bucket: "HIRED" | "PROCEED" | "REJECTED";
  outcome: "Hired" | "Proceed" | "Do Not Proceed" | "Rejected";
  decidedAt: string;
  comments: string | null;
};

export function getMyDecisionHistory() {
  return apiFetch<DecisionHistoryEntry[]>("/hiring-manager/decision-history");
}

// Corrections doc drill-down: Vacancies -> click a vacancy -> full candidate
// list -> click a candidate -> decision page.
export type VacancyCandidateRow = {
  applicationId: number;
  candidate: { id: number; name: string; email: string };
  stage: "APPLIED" | "SHORTLISTED" | "HIRED" | "REJECTED";
  round: { id: number; name: string; order: number } | null;
  awaitingDecision: boolean;
};

export function getVacancyCandidates(vacancyId: number) {
  return apiFetch<VacancyCandidateRow[]>(`/hiring-manager/vacancies/${vacancyId}/candidates`);
}

// Same shape as PendingDecision, generalized to any candidate on a vacancy
// this HM has access to (not just ones currently in the ready-for-decision
// queue) -- awaitingDecision tells the frontend whether to show the
// Proceed/Do Not Proceed/Hire/Reject buttons or a read-only view.
export type ApplicationDecision = {
  applicationId: number;
  candidate: { id: number; name: string };
  vacancy: { id: number; title: string };
  stage: "APPLIED" | "SHORTLISTED" | "HIRED" | "REJECTED";
  round: { id: number; name: string; order: number } | null;
  isFinalRound: boolean;
  awaitingDecision: boolean;
  score: number | null;
  commentsAvailable: boolean;
  comments: string[];
  waitingSince: string;
  feedbackHistory: FeedbackHistoryEntry[];
};

export function getApplicationDecision(applicationId: number) {
  return apiFetch<ApplicationDecision>(`/hiring-manager/applications/${applicationId}/decision`);
}

export type ComparisonCandidate = {
  applicationId: number;
  candidateId: number;
  name: string;
  score: number;
  rank: number;
  round: { id: number; name: string; order: number };
  comments: string[];
};

export type Comparison = {
  vacancy: { id: number; title: string };
  topCandidates: ComparisonCandidate[];
  summary: { topCandidateCount: number; averageScore: number | null; highestScore: number | null };
  distribution: { label: string; count: number }[];
  comments: { candidateId: number; name: string; comments: string[] }[];
};

export function getComparison(vacancyId: number) {
  return apiFetch<Comparison>(`/hiring-manager/vacancies/${vacancyId}/comparison`);
}
