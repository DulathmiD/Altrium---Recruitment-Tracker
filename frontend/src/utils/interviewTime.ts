// Extracted from InterviewsPage.tsx so this pure formatting logic can be unit
// tested without pulling in the whole page (React, API client modules, CSS)
// -- see src/utils/__tests__/interviewTime.test.ts.
//
// A start time alone ("12:07", using whatever hour format the browser's
// locale defaults to) doesn't tell HR how long the slot runs, and on a
// 24-hour-clock locale it isn't even obviously a time. This shows an
// explicit AM/PM start-end range instead, using the standard hour-long
// interview slot this app treats as the default (there's no separate
// duration field on InterviewSlot).
export const SLOT_DURATION_MINUTES = 60;

export function formatSlotTimeRange(scheduledAt: string): string {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  return `${fmt(start)} - ${fmt(end)}`;
}
