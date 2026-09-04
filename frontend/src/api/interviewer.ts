import { apiFetch } from "./client";
import type { CandidateApplicationRow, RecruitmentStage } from "./candidates";

// My Candidates: every candidate-application this interviewer has ever sat
// on a panel for (any interview, any round), regardless of outcome -- scope
// locked via wireframe review Q3 ("All, regardless of outcome"). Status is
// NOT a separate concept here: it's the same Unreviewed/Active/Rejected
// bucket HR's Candidates screen derives from `stage` (Q1's answer), so this
// reuses CandidateApplicationRow rather than inventing a new shape.
export type ListMyCandidatesFilters = {
  search?: string;
  stage?: RecruitmentStage;
  vacancyStageId?: number;
};

export function listMyCandidates(filters: ListMyCandidatesFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.vacancyStageId) params.set("vacancyStageId", String(filters.vacancyStageId));
  const qs = params.toString();
  return apiFetch<CandidateApplicationRow[]>(`/interviewer/candidates${qs ? `?${qs}` : ""}`);
}

// My Candidates landing page: "Vacancy - Interview Stage" groups this
// interviewer has actually panelled, per the corrections-doc restructure
// (locked answer: grouped by vacancy+stage, not just vacancy).
export type MyVacancyStageGroup = {
  vacancyId: number;
  vacancyTitle: string;
  vacancyStageId: number;
  vacancyStageName: string;
  vacancyStageOrder: number;
  candidateCount: number;
};

export function listMyVacancyStages() {
  return apiFetch<MyVacancyStageGroup[]>("/interviewer/vacancy-stages");
}
