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
};

export type VacancyInput = {
  title: string;
  department: string;
  description: string;
  requirements?: string;
  preferredSkills?: string;
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
