import { describe, it, expect } from "vitest";
import { formatSlotTimeRange } from "../interviewTime";

// Regression coverage for the "12:07 with no AM/PM, no end time" bug: the
// original code called toLocaleTimeString with no explicit hour12 flag, so
// it silently used the browser/OS locale's default (24-hour on the reporting
// user's machine) and never showed a duration. Fixed with an explicit
// hour12: true format plus a computed 60-minute end time.
describe("formatSlotTimeRange", () => {
  it("formats a morning time as a 12-hour AM range", () => {
    expect(formatSlotTimeRange("2026-08-19T09:00:00")).toBe("9:00 AM - 10:00 AM");
  });

  it("formats an afternoon time as a 12-hour PM range", () => {
    expect(formatSlotTimeRange("2026-08-19T14:30:00")).toBe("2:30 PM - 3:30 PM");
  });

  it("rolls over midday correctly (11:xx AM -> 12:xx PM)", () => {
    expect(formatSlotTimeRange("2026-08-19T11:45:00")).toBe("11:45 AM - 12:45 PM");
  });

  it("rolls over midnight correctly (11:xx PM -> 12:xx AM, next day)", () => {
    expect(formatSlotTimeRange("2026-08-19T23:15:00")).toBe("11:15 PM - 12:15 AM");
  });

  it("always shows an explicit AM/PM marker, never a bare 24-hour time", () => {
    const result = formatSlotTimeRange("2026-08-19T09:00:00");
    expect(result).toMatch(/AM|PM/);
  });
});
