import { apiFetch } from "./client";
import type { StaffRole } from "./staff";

export type InterviewPanelMember = {
  id: number;
  panelId: number;
  userId: number;
  user: { id: number; name: string; email: string; role: StaffRole };
};

export type InterviewPanel = {
  id: number;
  vacancyId: number;
  name: string;
  createdAt: string;
  members: InterviewPanelMember[];
};

export function listInterviewPanels(vacancyId: number) {
  return apiFetch<InterviewPanel[]>(`/vacancies/${vacancyId}/panels`);
}

export function createInterviewPanel(vacancyId: number, name: string, userIds: number[]) {
  return apiFetch<InterviewPanel>(`/vacancies/${vacancyId}/panels`, {
    method: "POST",
    body: JSON.stringify({ name, userIds }),
  });
}
