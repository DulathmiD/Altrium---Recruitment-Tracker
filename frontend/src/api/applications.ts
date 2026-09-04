import { apiFetch } from "./client";

// CV-review-phase decision only -- shortlist or reject a fresh (APPLIED)
// application. Interview-round progression and final HIRE/REJECT decisions
// go through the Hiring Manager's recommendation/decision endpoints instead,
// not this one (see application.controller.ts updateApplicationStatus).
export type ApplicationStatusTarget = "SHORTLISTED" | "REJECTED";

export function updateApplicationStatus(applicationId: number, status: ApplicationStatusTarget) {
  return apiFetch(`/applications/${applicationId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// Per-application, not vacancy-level -- see decision log "Wireframe review
// round 1" item 6 (the wireframe originally put Hiring Manager at the
// vacancy level, but assignHiringManager takes an applicationId).
export function assignHiringManager(applicationId: number, hiringManagerId: number) {
  return apiFetch(`/applications/${applicationId}/assign-hm`, {
    method: "PATCH",
    body: JSON.stringify({ hiringManagerId }),
  });
}

// US-19: Hiring Manager's binding recommendation. ADVANCE moves the
// candidate into the vacancy's next configured round; DO_NOT_PROGRESS
// rejects outright. Only valid at a non-final round -- the final round uses
// recordHiringDecision (HIRE/REJECT) instead, see below.
export type RecommendationValue = "ADVANCE" | "DO_NOT_PROGRESS";

export function submitStageRecommendation(applicationId: number, recommendation: RecommendationValue, comments?: string) {
  return apiFetch(`/applications/${applicationId}/recommendation`, {
    method: "POST",
    body: JSON.stringify({ recommendation, ...(comments ? { comments } : {}) }),
  });
}

// Final-round-only outcome. HIRE is rejected server-side unless the
// candidate has actually reached the vacancy's last configured round.
export type HiringDecisionValue = "HIRE" | "REJECT";

export function recordHiringDecision(applicationId: number, hiringDecision: HiringDecisionValue, comments?: string) {
  return apiFetch(`/applications/${applicationId}/decision`, {
    method: "PATCH",
    body: JSON.stringify({ hiringDecision, ...(comments ? { comments } : {}) }),
  });
}
