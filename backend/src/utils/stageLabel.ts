// Furthest round reached by any still-active (SHORTLISTED) candidate on a
// vacancy -- a vacancy doesn't have one true "current stage" once candidates
// spread across rounds, so this is a deliberate simplification (flagged in
// the decision log), not a stored/authoritative value. Originally written
// for the Hiring Manager Vacancies screen; extracted here so the Management
// Dashboard's Department Vacancies table can reuse the exact same rule
// instead of re-deriving it.
export function currentStageLabel(
  applications: { stage: string; currentVacancyStageId: number | null }[],
  rounds: { id: number; order: number; name: string }[]
): string {
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  let furthest: { order: number; name: string } | null = null;
  let hasShortlistedNoRound = false;
  let hasApplied = false;

  for (const app of applications) {
    if (app.stage === "SHORTLISTED") {
      if (app.currentVacancyStageId !== null) {
        const r = roundById.get(app.currentVacancyStageId);
        if (r && (!furthest || r.order > furthest.order)) furthest = { order: r.order, name: r.name };
      } else {
        hasShortlistedNoRound = true;
      }
    } else if (app.stage === "APPLIED") {
      hasApplied = true;
    }
  }

  if (furthest) return `Round ${furthest.order}: ${furthest.name}`;
  if (hasShortlistedNoRound) return "Shortlisted";
  if (hasApplied) return "Applied";
  return "No active candidates";
}
