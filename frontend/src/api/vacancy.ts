import { apiFetch } from "./client";

export type VacancyStatus = "OPEN" | "CLOSED" | "ON_HOLD";

export type Vacancy = {
  id: number;
  title: string;
  department: string;
  description: string;
  requirements: string | null;
  preferredSkills: string | null;
  status: VacancyStatus;
  createdAt: string;
  // Optional, set by HR -- never required. A vacancy with no target date
  // never counts as overdue/delayed anywhere (see fillTimelineStatus below).
  targetFillDate: string | null;
};

export type VacancyInput = {
  title: string;
  department: string;
  description: string;
  requirements?: string;
  preferredSkills?: string;
  // null explicitly clears an existing target date; undefined/omitted leaves
  // it untouched on update (matches the backend's parseTargetFillDate).
  targetFillDate?: string | null;
};

export function listVacancies() {
  return apiFetch<Vacancy[]>("/vacancies");
}

export function createVacancy(input: VacancyInput) {
  return apiFetch<Vacancy>("/vacancies", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateVacancy(id: number, input: Partial<VacancyInput & { status: VacancyStatus }>) {
  return apiFetch<Vacancy>(`/vacancies/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export type FillTimelineStatus = "ON_TRACK" | "DELAYED" | "OVERDUE" | "NO_TARGET";

// Shared across HM/Management/Leadership vacancy screens (not built yet --
// this lives here now so every screen that needs it derives the same way).
// Decided: fixed thresholds were rejected in favor of a real per-vacancy
// target date, set by HR. A vacancy with no target date is never
// delayed/overdue -- always NO_TARGET, rendered the same as "on track" but
// distinguishable if a screen wants to say "no target set" instead.
// Warning-window length (7 days) is an implementation default, not a
// separately confirmed decision -- easy to change in one place if wrong.
const DELAYED_WARNING_WINDOW_DAYS = 7;

export function fillTimelineStatus(vacancy: Pick<Vacancy, "targetFillDate" | "status">, now = new Date()): FillTimelineStatus {
  if (!vacancy.targetFillDate) return "NO_TARGET";
  if (vacancy.status !== "OPEN") return "NO_TARGET"; // closed/on-hold vacancies aren't "overdue" anymore
  const target = new Date(vacancy.targetFillDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilTarget = (target.getTime() - now.getTime()) / msPerDay;
  if (daysUntilTarget < 0) return "OVERDUE";
  if (daysUntilTarget <= DELAYED_WARNING_WINDOW_DAYS) return "DELAYED";
  return "ON_TRACK";
}

export function daysOpen(vacancy: Pick<Vacancy, "createdAt">, now = new Date()): number {
  const created = new Date(vacancy.createdAt);
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

// Authenticated PDF download (US-37/38) -- same blob-fetch pattern as
// fetchCvBlobUrl in candidates.ts, needed because the report route requires
// the auth header and a plain <a href> can't carry it.
export async function fetchVacancyReportPdfUrl(vacancyId: number): Promise<string> {
  const token = sessionStorage.getItem("token"); // see AuthContext.tsx's comment
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/vacancies/${vacancyId}/report/pdf`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data && data.error) || "Could not load report");
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
