import { apiFetch } from "./client";
import type { VacancyStatus } from "./vacancy";

export type AnchorStage = "APPLIED" | "SHORTLISTED" | "HIRED" | "REJECTED";

export type ManagementVacancy = {
  id: number;
  title: string;
  department: string;
  status: VacancyStatus;
  createdAt: string;
  targetFillDate: string | null;
  candidateCount: number;
  currentStage: string;
};

export type ManagementDashboard =
  | { hasDepartment: false }
  | {
      hasDepartment: true;
      department: string;
      openVacancies: number;
      activeCandidates: number;
      hiresThisMonth: number;
      rejected: number;
      anchors: { stage: AnchorStage; label: string; candidateCount: number }[];
      rounds: { order: number; label: string; candidateCount: number }[];
    };

export type DashboardFilters = { dateRange?: "7" | "30" | "90"; vacancyId?: number };

function toQuery(filters: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function getManagementDashboard(filters: DashboardFilters = {}) {
  return apiFetch<ManagementDashboard>(`/management/dashboard${toQuery(filters)}`);
}

export type DepartmentVacanciesResponse =
  | { hasDepartment: false }
  | { hasDepartment: true; vacancies: ManagementVacancy[] };

export function getDepartmentVacancies(filters: DashboardFilters = {}) {
  return apiFetch<DepartmentVacanciesResponse>(`/management/vacancies${toQuery(filters)}`);
}

export type CandidateProgressRow = {
  applicationId: number;
  candidate: { id: number; name: string };
  vacancy: { id: number; title: string };
  currentStage: string;
  daysAtStage: number;
  // Follow-up correction: renamed from "nextAction" -- these are read-only
  // status descriptions ("Awaiting interviewer feedback" etc.), not tasks
  // Management performs themselves, so the field name and the column header
  // built from it shouldn't imply otherwise.
  waitingOn: string;
  status: "Ready" | "Delayed" | "In Progress";
};

export type CandidateProgressResponse =
  | { hasDepartment: false }
  | {
      hasDepartment: true;
      anchors: { stage: AnchorStage; label: string; candidateCount: number }[];
      rounds: { order: number; label: string; candidateCount: number }[];
      rows: CandidateProgressRow[];
    };

export function getCandidateProgress() {
  return apiFetch<CandidateProgressResponse>("/management/candidate-progress");
}

export type UpcomingInterviewRow = {
  interviewId: number;
  scheduledAt: string;
  candidate: { id: number; name: string };
  vacancy: { id: number; title: string };
  round: { name: string; order: number; roundLabel: string | null };
};

export type UpcomingInterviewsResponse =
  | { hasDepartment: false }
  | { hasDepartment: true; rows: UpcomingInterviewRow[] };

export function getUpcomingInterviews(filters: DashboardFilters = {}) {
  return apiFetch<UpcomingInterviewsResponse>(`/management/upcoming-interviews${toQuery(filters)}`);
}

export type ReportType = "hiring-summary" | "candidate-progress" | "round-status" | "vacancy-ageing";

export type ReportsListResponse =
  | { hasDepartment: false }
  | { hasDepartment: true; reports: { type: ReportType; name: string }[] };

export function listManagementReports() {
  return apiFetch<ReportsListResponse>("/management/reports");
}

// Same authenticated-blob-fetch pattern as fetchVacancyReportPdfUrl in
// vacancy.ts -- the PDF route needs the auth header, which a plain <a href>
// can't carry.
export async function fetchManagementReportPdfUrl(type: ReportType): Promise<string> {
  const token = sessionStorage.getItem("token"); // see AuthContext.tsx's comment
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/management/reports/${type}/pdf`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data && data.error) || "Could not load report");
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
