import { describe, it, expect } from "vitest";
import { stageDisplayFor } from "../candidateStage";
import type { CandidateApplicationHistoryEntry } from "../../api/candidates";

function makeRow(overrides: Partial<CandidateApplicationHistoryEntry> = {}): CandidateApplicationHistoryEntry {
  return {
    id: 1,
    vacancyId: 1,
    stage: "SHORTLISTED",
    appliedAt: "2026-08-01T00:00:00.000Z",
    currentVacancyStageId: 1,
    vacancy: { id: 1, title: "Backend Engineer", department: "Engineering", status: "OPEN" },
    currentVacancyStage: { id: 1, name: "Technical Interview", order: 1 },
    ...overrides,
  };
}

describe("stageDisplayFor", () => {
  it("shows the round name plainly for a non-rejected application", () => {
    const result = stageDisplayFor(makeRow({ stage: "SHORTLISTED" }));
    expect(result).toEqual({ text: "Technical Interview", rejected: false });
  });

  it("appends '- Rejected' and flags rejected when the application was rejected", () => {
    const result = stageDisplayFor(makeRow({ stage: "REJECTED" }));
    expect(result).toEqual({ text: "Technical Interview - Rejected", rejected: true });
  });

  it("returns an empty, non-rejected display when there's no current round yet", () => {
    const result = stageDisplayFor(makeRow({ currentVacancyStage: null, stage: "APPLIED" }));
    expect(result).toEqual({ text: "", rejected: false });
  });

  it("returns an empty display even for a rejected application if it never reached a round", () => {
    // Guards against a subtle bug: rejection before any interview round
    // shouldn't render "- Rejected" hanging off an empty round name.
    const result = stageDisplayFor(makeRow({ currentVacancyStage: null, stage: "REJECTED" }));
    expect(result).toEqual({ text: "", rejected: false });
  });
});
