import { apiFetch } from "./client";
import type { StaffRole } from "./staff";

// US-10: a vacancy's standing interviewer/panel pool. Interviews can only be
// scheduled with panelists drawn from this list (enforced server-side in
// scheduleInterview).
export type VacancyInterviewer = {
  id: number;
  vacancyId: number;
  userId: number;
  user: {
    id: number;
    name: string;
    email: string;
    role: StaffRole;
  };
};

export function listVacancyInterviewers(vacancyId: number) {
  return apiFetch<VacancyInterviewer[]>(`/vacancies/${vacancyId}/interviewers`);
}

export function assignInterviewerToVacancy(vacancyId: number, userId: number) {
  return apiFetch<VacancyInterviewer>(`/vacancies/${vacancyId}/interviewers`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export function removeInterviewerFromVacancy(vacancyId: number, userId: number) {
  return apiFetch<void>(`/vacancies/${vacancyId}/interviewers/${userId}`, {
    method: "DELETE",
  });
}
