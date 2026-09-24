// Extracted from CandidateDetailPage.tsx so this pure display logic can be
// unit tested without pulling in the whole page (React, API client modules,
// CSS) -- see src/utils/__tests__/candidateStage.test.ts.
import type { CandidateApplicationHistoryEntry } from "../api/candidates";

export function stageDisplayFor(row: CandidateApplicationHistoryEntry): { text: string; rejected: boolean } {
  const roundName = row.currentVacancyStage?.name ?? "";
  if (!roundName) return { text: "", rejected: false };
  // Direct user correction: just the round name, not "Round Name - Rejected"
  // -- the caller already shows a separate red "Rejected" status pill on the
  // same row, so repeating the word here was redundant. Kept in sync with
  // the identical fix in CandidatesPage.tsx's own copy of this function.
  if (row.stage === "REJECTED") return { text: roundName, rejected: true };
  return { text: roundName, rejected: false };
}
