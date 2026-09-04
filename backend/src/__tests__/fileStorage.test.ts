import { describe, it, expect } from "vitest";
import { sanitizeForFilename } from "../utils/fileStorage.js";

describe("sanitizeForFilename", () => {
  it("replaces unsafe characters with underscores", () => {
    expect(sanitizeForFilename("Alice/Mensah: CV*.pdf")).toBe("Alice_Mensah_CV_pdf");
  });

  it("trims leading/trailing underscores left over from unsafe characters", () => {
    expect(sanitizeForFilename("  ../../etc/passwd")).toBe("etc_passwd");
  });

  it("keeps plain alphanumeric names untouched (aside from case)", () => {
    expect(sanitizeForFilename("AliceMensah123")).toBe("AliceMensah123");
  });

  it("caps the result at 60 characters", () => {
    const longName = "A".repeat(100);
    expect(sanitizeForFilename(longName).length).toBe(60);
  });

  it("falls back to a safe default when nothing usable remains", () => {
    expect(sanitizeForFilename("///***")).toBe("candidate");
    expect(sanitizeForFilename("")).toBe("candidate");
  });
});
