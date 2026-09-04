import { describe, it, expect } from "vitest";
import { guessName, EMAIL_REGEX, PHONE_REGEX } from "../utils/cvExtraction.js";

// cvExtraction.ts has no top-level Prisma import, so this file doesn't need
// the "../prisma.js" auto-mock the controller-touching test files use.

describe("guessName", () => {
  it("picks the first plausible name-like line", () => {
    expect(guessName(["Alice Mensah", "Software Engineer", "alice@example.com"])).toBe("Alice Mensah");
  });

  it("skips generic CV header words", () => {
    expect(guessName(["Curriculum Vitae", "Alice Mensah", "Software Engineer"])).toBe("Alice Mensah");
    expect(guessName(["Resume", "CV", "Personal Details", "Ben Castillo"])).toBe("Ben Castillo");
  });

  it("skips lines that look like an email or phone number", () => {
    expect(guessName(["alice@example.com", "+44 7700 900123", "Alice Mensah"])).toBe("Alice Mensah");
  });

  it("skips implausibly long lines", () => {
    const longLine = "This is a very long line that is far too long to plausibly be a person's real name at all";
    expect(guessName([longLine, "Alice Mensah"])).toBe("Alice Mensah");
  });

  it("only looks at the first 8 non-empty lines", () => {
    const lines = Array.from({ length: 8 }, (_, i) => `Header Line ${i}`).concat(["Alice Mensah"]);
    // None of the first 8 lines are generic header words or emails/phones, so
    // the 9th line (the real name) should never be reached.
    expect(guessName(lines)).toBe("Header Line 0");
  });

  it("returns null when nothing plausible is found", () => {
    expect(guessName(["Curriculum Vitae", "alice@example.com", "+44 7700 900123"])).toBeNull();
  });

  it("ignores blank lines", () => {
    expect(guessName(["", "  ", "Alice Mensah"])).toBe("Alice Mensah");
  });
});

describe("EMAIL_REGEX", () => {
  it("matches a well-formed email address", () => {
    expect(EMAIL_REGEX.test("Contact: alice.mensah+cv@example.co.uk")).toBe(true);
  });

  it("does not match plain text with no @ sign", () => {
    expect(EMAIL_REGEX.test("Alice Mensah, Software Engineer")).toBe(false);
  });
});

describe("PHONE_REGEX", () => {
  it("matches a phone number with separators", () => {
    expect(PHONE_REGEX.test("Phone: +44 7700 900123")).toBe(true);
    expect(PHONE_REGEX.test("(555) 123-4567")).toBe(true);
  });

  it("does not match a short number sequence", () => {
    expect(PHONE_REGEX.test("Room 42")).toBe(false);
  });
});
