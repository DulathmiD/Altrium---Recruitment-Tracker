import { apiFetch } from "./client";
import type { VacancyStatus } from "./vacancy";

export type RecruitmentStage = "APPLIED" | "SHORTLISTED" | "HIRED" | "REJECTED";

export type CandidateSummary = {
  id: number;
  name: string;
  email: string;
  phoneNumber: string | null;
  cvUrl: string;
  createdAt: string;
  // Already returned by the backend on every candidate payload (see
  // candidate.controller.ts, both getCandidate and listCandidates) -- these
  // were previously only declared on CandidateDetail below, even though
  // listCandidates' rows carry them too. Surfaced here so the Candidates
  // list can show/sort on "who last reviewed this CV, and when" (the CV
  // handoff indicator on In Progress rows) without a second round trip.
  lastCvReviewedAt: string | null;
  lastCvReviewedBy: { id: number; name: string; email: string } | null;
};

export type VacancyStageSummary = {
  id: number;
  name: string;
  order: number;
};

// Frontend-corrections pass: candidate detail view (getCandidate) -- who
// last reviewed this CV and when (set only via the "View CV" action on this
// page, see markCandidateReviewed below -- opening the page alone no longer
// counts), the HR review note (only set when HR explicitly saves one), and
// every application this candidate has across all vacancies ("Applicant
// History" in the wireframe).
export type CandidateApplicationHistoryEntry = {
  id: number;
  vacancyId: number;
  stage: RecruitmentStage;
  appliedAt: string;
  currentVacancyStageId: number | null;
  vacancy: { id: number; title: string; department: string; status: VacancyStatus };
  currentVacancyStage: VacancyStageSummary | null;
};

// Task #44: read-only log of emails sent to this candidate (offers,
// rejections, interview invitations), sourced from AuditLog NOTIFICATION_SENT
// entries filtered to this candidate's email -- see candidate.controller.ts.
// subject/body are only populated for emails sent after the content-capture
// fix -- older AuditLog rows predate it and come back null, which the UI
// treats as "content not available" rather than an empty message.
export type CandidateEmailHistoryEntry = {
  id: number;
  label: string;
  sentAt: string;
  subject: string | null;
  body: string | null;
};

export type CandidateDetail = CandidateSummary & {
  lastCvReviewedByUserId: number | null;
  lastCvReviewedAt: string | null;
  lastCvReviewNote: string | null;
  lastCvReviewedBy: { id: number; name: string; email: string } | null;
  applications: CandidateApplicationHistoryEntry[];
  emailHistory: CandidateEmailHistoryEntry[];
};

// Read-only -- no longer marks the candidate as reviewed as a side effect.
// That used to happen here (US-15: "viewing the CV is the review"), but per
// user correction, simply opening this page shouldn't count as a review on
// its own. Call markCandidateReviewed() below when HR actually views the
// CV file, so it takes both opening the candidate AND viewing the CV.
export function getCandidateDetail(candidateId: number) {
  return apiFetch<CandidateDetail>(`/candidates/${candidateId}`);
}

// Fired from the candidate detail page's "View CV" action -- the one place
// that both requires the candidate's row to already be open AND that the
// CV was actually looked at. Returns the updated lastCvReviewedBy/At so the
// caller can merge it into already-loaded candidate detail state.
export function markCandidateReviewed(candidateId: number) {
  return apiFetch<{
    id: number;
    lastCvReviewedByUserId: number | null;
    lastCvReviewedAt: string | null;
    lastCvReviewedBy: { id: number; name: string; email: string } | null;
  }>(`/candidates/${candidateId}/review`, { method: "POST" });
}

export function saveCandidateReviewNote(candidateId: number, reviewNote: string) {
  return apiFetch<CandidateSummary & { lastCvReviewNote: string | null }>(`/candidates/${candidateId}`, {
    method: "PATCH",
    body: JSON.stringify({ reviewNote }),
  });
}

// US-13 fix: one row per candidate-application (not per candidate) -- see
// decision log "Candidates screen: row scope resolved". `id` here is the
// CandidateApplication id; use `candidate.id` for CV/profile lookups.
export type CandidateApplicationRow = {
  id: number;
  candidateId: number;
  vacancyId: number;
  stage: RecruitmentStage;
  appliedAt: string;
  currentVacancyStageId: number | null;
  hiringManagerId: number | null;
  // Distinct from `stage === "REJECTED"` -- that can mean either an early
  // CV-screening rejection (this stays null) or a real post-interview
  // hiring decision (set to "REJECT" via recordHiringDecision). Only the
  // former can be reconsidered back to Shortlisted -- see
  // application.controller.ts's updateApplicationStatus.
  hiringDecision: "HIRE" | "REJECT" | null;
  candidate: CandidateSummary;
  vacancy: {
    id: number;
    title: string;
    department: string;
    status: VacancyStatus;
  };
  currentVacancyStage: VacancyStageSummary | null;
  hiringManager: { id: number; name: string; email: string } | null;
};

export type ListCandidatesFilters = {
  search?: string;
  vacancyId?: number;
  stage?: RecruitmentStage;
  // Frontend-corrections pass: filter by a specific interview round (e.g.
  // "Software Engineer - Technical Interview") rather than the coarse
  // Applied/Shortlisted/Hired/Rejected anchor -- see candidate.controller.ts.
  vacancyStageId?: number;
  // US-14: minimum interview feedback score -- "has scored at least this on
  // any interview," not scoped to the latest round (that "latest round
  // only" rule is specific to HM decision-making, not a general search
  // filter). Backend param already existed (candidate.controller.ts); this
  // was the missing frontend wiring.
  minScore?: number;
};

export function listCandidates(filters: ListCandidatesFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.vacancyId) params.set("vacancyId", String(filters.vacancyId));
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.vacancyStageId) params.set("vacancyStageId", String(filters.vacancyStageId));
  if (filters.minScore !== undefined) params.set("minScore", String(filters.minScore));
  const qs = params.toString();
  return apiFetch<CandidateApplicationRow[]>(`/candidates${qs ? `?${qs}` : ""}`);
}

export async function findCandidateByEmail(email: string): Promise<CandidateSummary | null> {
  const rows = await listCandidates({ search: email });
  const match = rows.find((r) => r.candidate.email.toLowerCase() === email.toLowerCase());
  return match ? match.candidate : null;
}

export function applyCandidateToVacancy(vacancyId: number, candidateId: number) {
  return apiFetch<{ id: number }>(`/vacancies/${vacancyId}/applications`, {
    method: "POST",
    body: JSON.stringify({ candidateId }),
  });
}

// --- CV extract -> review -> confirm (US-06/US-07 two-phase upload) ---

export type ExtractedCvFile = {
  fileId: string;
  originalName: string;
  extractedName: string | null;
  extractedEmail: string | null;
  extractedPhone: string | null;
};

// Multipart upload can't go through apiFetch (it always sends
// Content-Type: application/json). Kept local to this module rather than
// generalizing client.ts for a single caller.
async function apiFetchFormData<T>(path: string, formData: FormData): Promise<T> {
  const token = sessionStorage.getItem("token"); // see AuthContext.tsx's comment
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { method: "POST", headers, body: formData });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || "Something went wrong");
  }
  return data as T;
}

// Frontend-corrections pass: a non-PDF file no longer fails the whole batch
// -- `failed` lists the individual files that were skipped (wrong format),
// `files` is everything that actually got saved and extracted.
export type FailedCvFile = { originalName: string; error: string };

export function extractCvFiles(files: File[]) {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  return apiFetchFormData<{ files: ExtractedCvFile[]; failed: FailedCvFile[] }>("/candidates/cv-extract", formData);
}

export type ConfirmCvEntry = { fileId: string; name: string; email: string; phoneNumber?: string };

// SCRUM2-30: `matched` is a distinct outcome from `created`/`failed` -- the
// uploaded CV's email already belongs to an existing candidate in the
// system, so no new Candidate row was created. `existingVacancies` lists
// every other vacancy that person has already applied to, so HR sees
// exactly why this wasn't treated as a brand-new applicant.
export type ConfirmCvResult = {
  createdCount: number;
  matchedCount: number;
  failedCount: number;
  created: { fileId: string; candidateId: number; email: string }[];
  matched: { fileId: string; candidateId: number; email: string; existingName: string; existingVacancies: string[] }[];
  failed: { fileId?: string; error: string }[];
};

export function confirmCvUpload(candidates: ConfirmCvEntry[]) {
  return apiFetch<ConfirmCvResult>("/candidates/cv-confirm", {
    method: "POST",
    body: JSON.stringify({ candidates }),
  });
}

// Authenticated CV view -- the download route needs the auth header, so a
// plain <a href> won't work. Fetch as a blob and open an object URL instead.
export async function fetchCvBlobUrl(candidateId: number): Promise<string> {
  const token = sessionStorage.getItem("token"); // see AuthContext.tsx's comment
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/candidates/${candidateId}/cv`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data && data.error) || "Could not load CV");
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
