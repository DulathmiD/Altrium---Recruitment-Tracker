import { apiFetch } from "./client";

export type Feedback = {
  id: number;
  interviewId: number;
  interviewerId: number;
  score: number;
  comments: string;
  createdAt: string;
  interviewer: { id: number; name: string; email: string };
};

// Scoped to "my own" server-side (US-25 is HM-only -- a plain Interviewer
// never sees a peer panelist's feedback here, see feedback.controller.ts).
// Used to decide whether the Feedback screen opens in create or edit mode.
export function getMyFeedbackForInterview(interviewId: number) {
  return apiFetch<Feedback[]>(`/interviews/${interviewId}/feedback`);
}

export function submitFeedback(interviewId: number, input: { score: number; comments: string }) {
  return apiFetch<Feedback>(`/interviews/${interviewId}/feedback`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateFeedback(feedbackId: number, input: { score?: number; comments?: string; reason: string }) {
  return apiFetch<Feedback>(`/feedback/${feedbackId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
