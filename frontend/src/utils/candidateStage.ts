// Extracted from CandidateDetailPage.tsx so this pure display logic can be
// unit tested without pulling in the whole page (React, API client modules,
// CSS) -- see src/utils/__tests__/candidateStage.test.ts.
import type { CandidateApplicationHistoryEntry } from "../api/candidates";

export function stageDisplayFor(row: CandidateApplicationHistoryEntry): { text: string; rejected: boolean } {
  const roundName = row.currentVacancyStage?.name ?? "";
  if (!roundName) return { text: "", rejected: false };
  if (row.stage === "REJECTED") return { text: `${roundName} - Rejected`, rejected: true };
  return { text: roundName, rejected: false };
}
