import { PDFParse } from "pdf-parse";

export interface CvExtractionResult {
  text: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
export const PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/;
const GENERIC_HEADER_WORDS = ["curriculum vitae", "resume", "cv", "personal details", "profile"];

// Best-effort heuristic: a real name-entity extractor is out of scope for this
// project, so we scan the first several non-empty lines of the document and
// pick the first one that isn't a generic header, an email/phone line, or
// implausibly long to be a person's name. HR reviews and can correct this
// before it's saved, so false positives here are not destructive.
export function guessName(lines: string[]): string | null {
  const candidates = lines.slice(0, 8);
  for (const raw of candidates) {
    const line = raw.trim();
    if (!line) continue;
    if (line.length > 60) continue;
    if (EMAIL_REGEX.test(line)) continue;
    if (PHONE_REGEX.test(line)) continue;
    if (GENERIC_HEADER_WORDS.includes(line.toLowerCase())) continue;
    return line;
  }
  return null;
}

export async function extractCvData(buffer: Buffer): Promise<CvExtractionResult> {
  const parser = new PDFParse({ data: buffer });
  let text = "";
  try {
    const result = await parser.getText();
    text = result.text ?? "";
  } finally {
    await parser.destroy();
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const emailMatch = text.match(EMAIL_REGEX);
  const phoneMatch = text.match(PHONE_REGEX);

  return {
    text,
    name: guessName(lines),
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0].trim() : null,
  };
}
