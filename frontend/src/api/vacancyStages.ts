import { apiFetch } from "./client";

export type VacancyStage = {
  id: number;
  vacancyId: number;
  name: string;
  order: number;
  // Per-round now (was a single vacancy-wide flag) -- true once a candidate
  // has ever entered this specific round. Later, still-untouched rounds stay
  // editable even while earlier rounds are locked.
  locked: boolean;
};

export type VacancyStagesResponse = {
  stages: VacancyStage[];
};

export function listVacancyStages(vacancyId: number) {
  return apiFetch<VacancyStagesResponse>(`/vacancies/${vacancyId}/stages`);
}

export function createVacancyStage(vacancyId: number, name: string) {
  return apiFetch<VacancyStage>(`/vacancies/${vacancyId}/stages`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function renameVacancyStage(vacancyId: number, stageId: number, name: string) {
  return apiFetch<VacancyStage>(`/vacancies/${vacancyId}/stages/${stageId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteVacancyStage(vacancyId: number, stageId: number) {
  return apiFetch<void>(`/vacancies/${vacancyId}/stages/${stageId}`, {
    method: "DELETE",
  });
}

// order = every stage id for this vacancy, in the desired sequence.
export function reorderVacancyStages(vacancyId: number, order: number[]) {
  return apiFetch<VacancyStage[]>(`/vacancies/${vacancyId}/stages/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ order }),
  });
}
