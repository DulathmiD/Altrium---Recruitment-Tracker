// Generates a real, one-page PDF resume for a seeded candidate -- used so
// "click the CV" in the demo actually opens a proper-looking document
// instead of 404ing. Previously, seed-full-demo.ts's ensureCandidate() set
// cvUrl to a filename string (e.g. "noah_bennett_cv.pdf") that was never
// actually written to backend/uploads/cvs -- candidate.controller.ts's
// getCandidateCv() would 404 with "CV file not found in storage" the moment
// anyone clicked it. This generates real PDF bytes with PDFKit (already a
// project dependency -- see pdfReport.ts) and the caller is expected to
// persist them via fileStorage.saveFile(), the same function the real
// upload endpoint uses, so a generated CV is indistinguishable in storage
// from one a real user uploaded.
import PDFDocument from "pdfkit";

const INK = "#1a1a1a";
const INK_SOFT = "#5b5b5b";
const GOLD = "#b8860b";
const LINE = "#d8d3c8";

export type CvExperience = {
  title: string;
  company: string;
  period: string;
  bullets: string[];
};

export type CvProfile = {
  name: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  summary: string;
  experience: CvExperience[];
  education: { degree: string; school: string; period: string };
  skills: string[];
};

export function buildCvPdf(profile: CvProfile): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // --- Header ---
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(24).text(profile.name);
    doc.moveDown(0.15);
    doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(12).text(profile.headline.toUpperCase(), { characterSpacing: 0.8 });
    doc.moveDown(0.3);
    doc.fillColor(INK_SOFT).font("Helvetica").fontSize(10.5).text(`${profile.email}   ·   ${profile.phone}   ·   ${profile.location}`);

    doc.moveDown(0.6);
    doc.strokeColor(LINE).lineWidth(1).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + pageWidth, doc.y).stroke();
    doc.moveDown(0.8);

    function sectionHeading(text: string) {
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(11.5).text(text.toUpperCase(), { characterSpacing: 1 });
      doc.moveDown(0.35);
    }

    // --- Summary ---
    sectionHeading("Professional Summary");
    doc.fillColor(INK).font("Helvetica").fontSize(10.5).text(profile.summary, { width: pageWidth, lineGap: 2 });
    doc.moveDown(0.9);

    // --- Experience ---
    sectionHeading("Experience");
    for (const job of profile.experience) {
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(10.8).text(job.title, { continued: true });
      doc.font("Helvetica").fillColor(INK_SOFT).text(`  —  ${job.company}`);
      doc.font("Helvetica").fillColor(INK_SOFT).fontSize(9.5).text(job.period);
      doc.moveDown(0.3);
      doc.fillColor(INK).font("Helvetica").fontSize(10);
      for (const bullet of job.bullets) {
        doc.text(`•  ${bullet}`, { width: pageWidth, indent: 4, lineGap: 1.5 });
      }
      doc.moveDown(0.6);
    }

    // --- Education ---
    sectionHeading("Education");
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(10.8).text(profile.education.degree, { continued: true });
    doc.font("Helvetica").fillColor(INK_SOFT).text(`  —  ${profile.education.school}`);
    doc.font("Helvetica").fillColor(INK_SOFT).fontSize(9.5).text(profile.education.period);
    doc.moveDown(0.9);

    // --- Skills ---
    sectionHeading("Skills");
    doc.fillColor(INK).font("Helvetica").fontSize(10.5).text(profile.skills.join("   ·   "), { width: pageWidth, lineGap: 2 });

    doc.end();
  });
}
