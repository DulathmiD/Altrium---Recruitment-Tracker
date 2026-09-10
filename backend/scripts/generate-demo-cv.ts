// One-off (but reusable) generator for a "brand new" CV to upload LIVE during
// a viva -- distinct from every seeded candidate, so HR's real Upload CV /
// Extract / Review flow gets exercised against a file that was never
// pre-loaded into the database. Uses the exact same buildCvPdf() every
// seeded candidate's CV already goes through (scripts/lib/generateCv.ts), so
// this looks visually identical to every other CV in the system -- not an
// obviously different "demo" document.
//
// Run from the backend folder:
//   npx tsx scripts/generate-demo-cv.ts [output-path]
// Defaults to writing ./Freddie_Sandhu_CV.pdf in the current directory if no
// path is given. To generate a different demo candidate later (e.g. for a
// Sprint 2 viva), just edit the PROFILE object below and rerun.
import fs from "node:fs";
import { buildCvPdf, type CvProfile } from "./lib/generateCv.js";

const PROFILE: CvProfile = {
  name: "Freddie Sandhu",
  email: "freddie.sandhu@example.com",
  phone: "+44 7700 900200",
  location: "Manchester, UK",
  headline: "DevOps Engineer",
  summary:
    "DevOps engineer with four years' experience building CI/CD pipelines and managing cloud infrastructure for fast-moving product teams. Comfortable owning deployment reliability end to end, from build pipeline to production monitoring.",
  experience: [
    {
      title: "DevOps Engineer",
      company: "Brightfield Systems",
      period: "2022 – Present",
      bullets: [
        "Migrated deployment pipeline from manual releases to a fully automated CI/CD flow, cutting release time from 2 hours to 12 minutes.",
        "Introduced infrastructure-as-code (Terraform) for all cloud resources, eliminating configuration drift between environments.",
      ],
    },
    {
      title: "Junior Systems Engineer",
      company: "Kestrel Cloud Ltd",
      period: "2020 – 2022",
      bullets: [
        "Maintained CI pipelines and monitoring dashboards for a 15-engineer product team.",
        "Reduced average incident response time by 40% through improved alerting rules.",
      ],
    },
  ],
  education: { degree: "BSc Computer Science", school: "Manchester Metropolitan University", period: "2016 – 2020" },
  skills: ["CI/CD", "Terraform", "AWS", "Docker", "Kubernetes", "Monitoring & Alerting"],
};

async function main() {
  const outputPath = process.argv[2] || "./Freddie_Sandhu_CV.pdf";
  const pdfBytes = await buildCvPdf(PROFILE);
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`Wrote ${outputPath} (${(pdfBytes.length / 1024).toFixed(1)} KB) for ${PROFILE.name}.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
