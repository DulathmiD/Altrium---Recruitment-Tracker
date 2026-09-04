import { apiFetch } from "./client";

// Org-wide KPI/stage-monitoring endpoints (backend/src/controllers/
// reports.controller.ts, mounted at /api/reports with no role gate beyond
// requireAuth) -- already used by Management's regression coverage, now
// also the backend for Leadership's Recruitment Overview tab. No new
// backend surface needed for this Sprint 1 scope: "KPIs + round-by-round
// breakdown, using endpoints that already exist" (see decision log).

export type AnchorStage = "APPLIED" | "SHORTLISTED" | "HIRED" | "REJECTED";

export type Kpis = {
  applicationsReceived: number;
  shortlisted: number;
  interviewsScheduled: number;
  interviewsCompleted: number;
  hires: number;
  rejected: number;
  openVacancies: number;
  averageTimeToHireDays: number | null;
};

export function getKpis(vacancyId?: number) {
  const qs = vacancyId ? `?vacancyId=${vacancyId}` : "";
  return apiFetch<Kpis>(`/reports/kpis${qs}`);
}

export type StageMonitoring = {
  anchors: { stage: AnchorStage; label: string; candidateCount: number }[];
  rounds: { order: number; label: string; candidateCount: number }[];
};

export function getStageMonitoring(vacancyId?: number) {
  const qs = vacancyId ? `?vacancyId=${vacancyId}` : "";
  return apiFetch<StageMonitoring>(`/reports/stage-monitoring${qs}`);
}
