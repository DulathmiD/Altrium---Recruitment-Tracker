import { apiFetch } from "./client";

export type AnchorStage = "APPLIED" | "SHORTLISTED" | "HIRED" | "REJECTED";

export type ScopeFilters = { dateRange?: "7" | "30" | "90"; department?: string; vacancyId?: number };

function toQuery(filters: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export type LeadershipAttentionItem = { type: "DECISION" | "FEEDBACK" | "AGEING"; label: string; link: string | null };

export type LeadershipDashboard = {
  openVacancies: number;
  activeCandidates: number;
  hiresThisMonth: number;
  rejected: number;
  anchors: { stage: AnchorStage; label: string; candidateCount: number }[];
  rounds: { order: number; label: string; candidateCount: number }[];
  attentionItems: LeadershipAttentionItem[];
};

export function getLeadershipDashboard(filters: ScopeFilters = {}) {
  return apiFetch<LeadershipDashboard>(`/leadership/dashboard${toQuery(filters)}`);
}

export function listLeadershipDepartments() {
  return apiFetch<{ departments: string[] }>("/leadership/departments");
}

export type LeadershipVacancyOption = { id: number; title: string; department: string };

export function listLeadershipVacancies(department?: string) {
  return apiFetch<{ vacancies: LeadershipVacancyOption[] }>(`/leadership/vacancies${toQuery({ department })}`);
}

export type RecruitmentProgressRow = {
  applicationId: number;
  candidate: { id: number; name: string };
  vacancy: { id: number; title: string; department: string };
  currentStage: string;
  daysAtStage: number;
  nextAction: string;
  status: "Ready" | "Delayed" | "In Progress";
};

export type RecruitmentProgressResponse = {
  anchors: { stage: AnchorStage; label: string; candidateCount: number }[];
  rounds: { order: number; label: string; candidateCount: number }[];
  rows: RecruitmentProgressRow[];
};

export function getRecruitmentProgress(filters: ScopeFilters = {}) {
  return apiFetch<RecruitmentProgressResponse>(`/leadership/recruitment-progress${toQuery(filters)}`);
}

export type DepartmentPerformanceRow = {
  department: string;
  fillRate: number;
  avgTimeToHireDays: number | null;
  openRoles: number;
  overdueRoles: number;
  hired: number;
  rejected: number;
};

export type DepartmentPerformanceResponse = {
  summary: {
    bestFillRate: { department: string; value: number } | null;
    fastestHiring: { department: string; days: number } | null;
    mostOpenRoles: { department: string; count: number } | null;
    overdueRoles: number;
  };
  hiredByDepartment: { department: string; count: number }[];
  rejectedByDepartment: { department: string; count: number }[];
  rows: DepartmentPerformanceRow[];
};

export function getDepartmentPerformance(filters: ScopeFilters = {}) {
  return apiFetch<DepartmentPerformanceResponse>(`/leadership/department-performance${toQuery(filters)}`);
}

export type HiringTrendsResponse = {
  applications: number;
  candidatesInRounds: number;
  hired: number;
  rejected: number;
  trend: { label: string; count: number }[];
};

export function getHiringTrends(filters: ScopeFilters = {}) {
  return apiFetch<HiringTrendsResponse>(`/leadership/hiring-trends${toQuery(filters)}`);
}

export type LeadershipReportType = "recruitment-performance" | "department-performance" | "round-performance" | "vacancy-status";

export function listLeadershipReports() {
  return apiFetch<{ reports: { type: LeadershipReportType; name: string }[] }>("/leadership/reports");
}

export async function fetchLeadershipReportPdfUrl(type: LeadershipReportType): Promise<string> {
  const token = sessionStorage.getItem("token"); // see AuthContext.tsx's comment
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/leadership/reports/${type}/pdf`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data && data.error) || "Could not load report");
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
