// NOTE: still useful for exercising the reminder cron job itself (point 2
// below), but the vacancy/candidate it creates (point 1) sits under a
// department name outside HR's 8 canonical ones seeded by
// scripts/seed-full-demo.ts (see project-decisions-log.md's "Seventeenth
// pass") -- running this after a full reset adds one vacancy nothing else in
// the system's department taxonomy recognizes. Harmless, just inconsistent.
//
// One-shot demo/test data for the 4 features built this pass (SCRUM2-29,
// 30, 31, 45). Safe to re-run -- every lookup is find-or-create.
//
// What it does:
//   1. Seeds a vacancy + candidate + interview slot scheduled 2 hours from
//      now (inside the reminder job's 24h window), with the seeded
//      interviewer as panelist -- SCRUM2-29 needs a slot in that window to
//      have anything to remind about.
//   2. Immediately runs the reminder check ONCE, synchronously, instead of
//      waiting for the real cron's next 15-minute tick -- so you see the
//      result right away rather than waiting.
//   3. Writes a second, blank-content demo CV PDF to
//      backend/scripts/demo-cv-duplicate.pdf, with instructions below for
//      manually triggering SCRUM2-30 (duplicate detection) through the real
//      UI, since that one has to go through an actual file upload.
//
// Run from the backend folder (after `npm install`, `npx prisma migrate dev`,
// and `npx prisma generate` have all been run):
//   npx tsx scripts/demo-new-features.ts
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/prisma.js";
import { runInterviewReminderCheck } from "../src/jobs/interviewReminders.js";

const HOUR_MS = 60 * 60 * 1000;
const DEMO_EMAIL = "priya.sharma.demo@example.com";

// Same hand-built single-page PDF approach as the Selenium suite's
// helpers.make_test_pdf() (Python) -- no PDF library dependency needed for a
// throwaway fixture.
function makeDemoPdf(lines: string[]): Buffer {
  const contentLines = lines.map((line, i) => {
    const escaped = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    return `BT /F1 12 Tf 50 ${700 - i * 20} Td (${escaped}) Tj ET`;
  });
  const contentStream = Buffer.from(contentLines.join("\n"), "latin1");

  const objects = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"
    ),
    Buffer.concat([
      Buffer.from(`<< /Length ${contentStream.length} >>\nstream\n`),
      contentStream,
      Buffer.from("\nendstream"),
    ]),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
  ];

  const header = Buffer.from("%PDF-1.4\n");
  const chunks: Buffer[] = [header];
  const offsets: number[] = [];
  let offset = header.length;
  objects.forEach((obj, i) => {
    offsets.push(offset);
    const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), obj, Buffer.from("\nendobj\n")]);
    chunks.push(chunk);
    offset += chunk.length;
  });
  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${off.toString().padStart(10, "0")} 00000 n \n`;
  chunks.push(Buffer.from(xref));
  chunks.push(Buffer.from(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));

  return Buffer.concat(chunks);
}

async function main() {
  const interviewer = await prisma.user.findUnique({ where: { email: "interviewer@altrium.com" } });
  if (!interviewer) {
    console.error('Could not find the seeded interviewer (interviewer@altrium.com). Run "npx prisma db seed" first.');
    process.exitCode = 1;
    return;
  }

  // --- 1. Vacancy + stage ---
  let vacancy = await prisma.vacancy.findUnique({
    where: { title_department: { title: "SCRUM2 Demo Role", department: "IT" } },
  });
  if (!vacancy) {
    vacancy = await prisma.vacancy.create({
      data: { title: "SCRUM2 Demo Role", department: "IT", description: "Demo vacancy for SCRUM2-29/30/31/45.", status: "OPEN" },
    });
    console.log(`Created vacancy "${vacancy.title}" (id ${vacancy.id})`);
  }
  let stage = await prisma.vacancyStage.findUnique({
    where: { vacancyId_order: { vacancyId: vacancy.id, order: 1 } },
  });
  if (!stage) {
    stage = await prisma.vacancyStage.create({ data: { vacancyId: vacancy.id, name: "Technical Interview", order: 1 } });
  }

  const existingPanelLink = await prisma.vacancyInterviewer.findUnique({
    where: { vacancyId_userId: { vacancyId: vacancy.id, userId: interviewer.id } },
  });
  if (!existingPanelLink) {
    await prisma.vacancyInterviewer.create({ data: { vacancyId: vacancy.id, userId: interviewer.id } });
  }

  // --- 2. Candidate + application (for the reminder demo) ---
  let candidate = await prisma.candidate.findUnique({ where: { email: DEMO_EMAIL } });
  if (!candidate) {
    candidate = await prisma.candidate.create({
      data: { name: "Priya Sharma", email: DEMO_EMAIL, cvUrl: "priya_sharma_demo_cv.pdf" },
    });
    console.log(`Created candidate "${candidate.name}" <${candidate.email}>`);
  } else {
    console.log(`Reusing existing candidate "${candidate.name}" <${candidate.email}> (id ${candidate.id}) -- this is the record SCRUM2-30's duplicate check should find.`);
  }

  let application = await prisma.candidateApplication.findUnique({
    where: { candidateId_vacancyId: { candidateId: candidate.id, vacancyId: vacancy.id } },
  });
  if (!application) {
    application = await prisma.candidateApplication.create({
      data: { candidateId: candidate.id, vacancyId: vacancy.id, stage: "SHORTLISTED", currentVacancyStageId: stage.id },
    });
    console.log(`Applied "${candidate.name}" to "${vacancy.title}" (application id ${application.id})`);
  }

  // --- 3. Interview slot 2 hours from now (inside the reminder job's 24h window) ---
  let slot = await prisma.interviewSlot.findFirst({
    where: { vacancyStageId: stage.id, interviews: { some: { applicationId: application.id } } },
  });
  if (!slot) {
    slot = await prisma.interviewSlot.create({
      data: {
        vacancyStageId: stage.id,
        scheduledAt: new Date(Date.now() + 2 * HOUR_MS),
        panelists: { create: [{ userId: interviewer.id }] },
      },
    });
    await prisma.interview.create({ data: { slotId: slot.id, applicationId: application.id } });
    console.log(`Created interview slot 2 hours from now (id ${slot.id}), panelist: ${interviewer.name}`);
  } else if (slot.reminderSentAt) {
    // Re-running the script after a previous run already sent the reminder --
    // reset it so this run demonstrates the send again instead of skipping.
    await prisma.interviewSlot.update({ where: { id: slot.id }, data: { reminderSentAt: null } });
    console.log(`Reusing interview slot (id ${slot.id}) -- reset reminderSentAt so the check below sends again.`);
  } else {
    console.log(`Reusing interview slot (id ${slot.id}), reminder not yet sent.`);
  }

  // --- 4. Trigger the reminder check right now (SCRUM2-29) ---
  console.log("\nRunning the interview reminder check now (normally runs every 15 min via cron)...");
  await runInterviewReminderCheck();
  console.log("Done. Check the console output above for the DEV EMAIL blocks (SMTP not configured) -- one to the candidate, one to the panelist.");

  // --- 5. Write a duplicate-test CV fixture for the SCRUM2-30 manual step ---
  const fixturePath = path.join(fileURLToPath(new URL(".", import.meta.url)), "demo-cv-duplicate.pdf");
  fs.writeFileSync(fixturePath, makeDemoPdf(["Priya Sharma", DEMO_EMAIL, "+44 7000 000000"]));
  console.log(`\nWrote a demo CV PDF for the duplicate-detection test: ${fixturePath}`);

  console.log(`
======================================================================
Manual checks in the actual website (http://localhost:5173):

1) SCRUM2-29 (interview reminders) -- already triggered above.
   Log in as HR (hr@altrium.com / password123) -> Interviews page ->
   look for the "SCRUM2 Demo Role" slot 2 hours out.
   Log in as Interviewer (interviewer@altrium.com / password123) ->
   the notification bell (sidebar, above Log out) should show 1 unread:
   "Reminder: you're interviewing Priya Sharma...".
   Log in as IT Admin (itadmin@altrium.com / password123) -> Audit Logs
   -> filter "Notifications" -> two new NOTIFICATION_SENT rows
   (reason interview_reminder_candidate / interview_reminder_panelist).

2) SCRUM2-30 (duplicate detection) -- needs one manual step:
   Log in as HR -> Candidates -> Upload CV -> pick a DIFFERENT vacancy
   than "SCRUM2 Demo Role" (Priya already has an application there) ->
   upload ${fixturePath} -> Confirm & Apply.
   Expect an amber toast: "Priya Sharma (${DEMO_EMAIL}) already exists
   in the system -- previously applied to: SCRUM2 Demo Role. Linked
   this upload to their existing profile instead of creating a duplicate."

3) SCRUM2-45 (configurable templates):
   Log in as IT Admin -> Notification Templates (new sidebar item) ->
   edit "Interview reminder - candidate (SCRUM2-29)" -> change the
   subject -> Save -> re-run this script -> the new subject appears in
   the DEV EMAIL console output instead of the default text.

4) SCRUM2-31 (in-app notifications) -- the bell used in (1) above is
   this feature; also try Follow Ups (as HR) -> resend a feedback
   reminder or panelist invite -> that panelist's bell gets a new entry.
======================================================================
`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
