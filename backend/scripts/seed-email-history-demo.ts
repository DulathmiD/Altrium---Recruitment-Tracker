// Test-case script for the Forty-first pass (Email History content). Builds
// one fully-populated candidate so every section of the Candidate Detail
// page has something real in it, and sends two ACTUAL emails through the
// real template + mailer + audit-log code path (not faked data) so Email
// History shows genuine subject/body content, exactly like a real send
// would produce.
//
// What it creates:
//   - Candidate "Noah Bennett" <noah.bennett@example.com>, phone set, CV
//     filename set, Review Notes filled in (reviewed by Hannah HR, with a
//     note) -- so the top section isn't blank.
//   - Vacancy "Backend Engineer" / "Engineering" (2 stages: Technical
//     Interview, Final Interview). Noah is SHORTLISTED here, with Harry
//     Dawson assigned as Hiring Manager.
//       - Round 1 (Technical Interview) interview slot 2 days AGO, with Ian
//         Foster as panelist -- this is where the real round-1 auto-invite
//         email gets sent (renderTemplate + sendEmail + writeAuditLog, the
//         exact same calls interview.controller.ts's scheduleInterview
//         makes), so it shows up under Completed Interviews AND as a real
//         "Interview invitation" row in Email History.
//       - Round 2 (Final Interview) interview slot 3 days from NOW, with
//         Ian Foster + Mary Management as panelists -- shows under Upcoming
//         Interviews. No auto-email for this one (correct: only round 1
//         auto-sends), so it's a live example of that rule too.
//   - Vacancy "Product Designer" / "Design", a SEPARATE, already-concluded
//     application for the same candidate: HIRED, with a real "Congratulations"
//     offer email sent the same way recordHiringDecision does it. This is
//     what shows up under Applicant History when viewing either application,
//     and gives Email History a second, differently-labeled entry so you can
//     see the label styling vary ("Interview invitation" vs "Offer email").
//
// Every step is find-or-create / guarded by an existing-audit-log check, so
// this is safe to re-run -- it won't create duplicate rows or re-send either
// email on a second run.
//
// Run from the backend folder:
//   npx tsx scripts/seed-email-history-demo.ts
//
// Then in the app: Candidates -> search "Noah Bennett" -> open either
// application. Email History will show both real emails -- click a row to
// expand it and see the actual subject/body that was sent.
import "dotenv/config";
import { prisma } from "../src/prisma.js";
import { sendEmail } from "../src/utils/mailer.js";
import { renderTemplate, type TemplateKey } from "../src/utils/notificationTemplates.js";
import { writeAuditLog } from "../src/utils/auditLog.js";

const DAY_MS = 24 * 60 * 60 * 1000;

async function requireUser(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`Could not find seeded user ${email}. Run "npx prisma db seed" first.`);
  }
  return user;
}

async function ensureVacancy(title: string, department: string, description: string) {
  const existing = await prisma.vacancy.findUnique({ where: { title_department: { title, department } } });
  if (existing) return existing;
  const created = await prisma.vacancy.create({ data: { title, department, description, status: "OPEN" } });
  console.log(`Created vacancy "${created.title}" (id ${created.id})`);
  return created;
}

async function ensureStage(vacancyId: number, name: string, order: number) {
  const existing = await prisma.vacancyStage.findUnique({ where: { vacancyId_order: { vacancyId, order } } });
  if (existing) return existing;
  return prisma.vacancyStage.create({ data: { vacancyId, name, order } });
}

async function ensureInterviewerPool(vacancyId: number, userId: number) {
  const existing = await prisma.vacancyInterviewer.findUnique({ where: { vacancyId_userId: { vacancyId, userId } } });
  if (!existing) await prisma.vacancyInterviewer.create({ data: { vacancyId, userId } });
}

// Guards a real send: only fires (and logs) once per entity+reason, so
// re-running this script doesn't re-send/re-log the same email.
async function sendOnceAndLog(opts: {
  actorUserId: number;
  entityType: string;
  entityId: number;
  recipient: string;
  reason: TemplateKey;
  vars: Record<string, string>;
}) {
  const already = await prisma.auditLog.findFirst({
    where: { action: "NOTIFICATION_SENT", entityType: opts.entityType, entityId: opts.entityId },
  });
  if (already) {
    console.log(`  Email for ${opts.entityType} #${opts.entityId} (${opts.reason}) already sent -- skipped`);
    return;
  }
  const { subject, body } = await renderTemplate(opts.reason, opts.vars);
  await sendEmail({ to: opts.recipient, subject, body });
  await writeAuditLog(opts.actorUserId, "NOTIFICATION_SENT", opts.entityType, opts.entityId, {
    recipient: opts.recipient,
    channel: "email",
    reason: opts.reason,
    subject,
    body,
  });
  console.log(`  Sent + logged "${opts.reason}" email to ${opts.recipient} (subject: "${subject}")`);
}

async function main() {
  const hr = await requireUser("hr@altrium.com");
  const interviewer = await requireUser("interviewer@altrium.com");
  const management = await requireUser("management@altrium.com");
  const hiringManager = await requireUser("hiringmanager@altrium.com");

  // --- Candidate, with Review Notes filled in ---
  let candidate = await prisma.candidate.findUnique({ where: { email: "noah.bennett@example.com" } });
  if (!candidate) {
    candidate = await prisma.candidate.create({
      data: {
        name: "Noah Bennett",
        email: "noah.bennett@example.com",
        phoneNumber: "+44 7700 900456",
        cvUrl: "noah_bennett_cv.pdf",
        lastCvReviewedByUserId: hr.id,
        lastCvReviewedAt: new Date(),
        lastCvReviewNote: "Strong CV -- four years' experience with distributed backend systems. Moved to shortlist.",
      },
    });
    console.log(`Created candidate "${candidate.name}" <${candidate.email}>`);
  } else {
    console.log(`Reusing candidate "${candidate.name}" (id ${candidate.id})`);
  }

  // --- Vacancy 1: Backend Engineer -- SHORTLISTED, HM assigned, one
  //     completed interview (real invite email) + one upcoming interview ---
  const vacancy1 = await ensureVacancy(
    "Backend Engineer",
    "Engineering",
    "We're hiring a backend engineer to help scale our core platform services."
  );
  const stage1 = await ensureStage(vacancy1.id, "Technical Interview", 1);
  const stage2 = await ensureStage(vacancy1.id, "Final Interview", 2);
  await ensureInterviewerPool(vacancy1.id, interviewer.id);
  await ensureInterviewerPool(vacancy1.id, management.id);

  let application1 = await prisma.candidateApplication.findUnique({
    where: { candidateId_vacancyId: { candidateId: candidate.id, vacancyId: vacancy1.id } },
  });
  if (!application1) {
    application1 = await prisma.candidateApplication.create({
      data: {
        candidateId: candidate.id,
        vacancyId: vacancy1.id,
        stage: "SHORTLISTED",
        currentVacancyStageId: stage1.id,
        hiringManagerId: hiringManager.id,
      },
    });
    console.log(`Applied "${candidate.name}" to "${vacancy1.title}" (application id ${application1.id})`);
  }

  // Completed interview (2 days ago) -- round 1, triggers the real auto-invite email.
  let pastInterview = await prisma.interview.findFirst({
    where: { applicationId: application1.id, slot: { vacancyStageId: stage1.id } },
  });
  if (!pastInterview) {
    const pastDate = new Date(Date.now() - 2 * DAY_MS);
    pastDate.setHours(11, 0, 0, 0);
    const pastSlot = await prisma.interviewSlot.create({
      data: {
        vacancyStageId: stage1.id,
        scheduledAt: pastDate,
        panelists: { create: [{ userId: interviewer.id }] },
      },
    });
    pastInterview = await prisma.interview.create({ data: { slotId: pastSlot.id, applicationId: application1.id } });
    console.log(`Created completed round-1 interview for "${candidate.name}" on "${vacancy1.title}"`);

    const when = pastDate.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
    await sendOnceAndLog({
      actorUserId: hr.id,
      entityType: "Interview",
      entityId: pastInterview.id,
      recipient: candidate.email,
      reason: "interview_scheduled_candidate",
      vars: { candidateName: candidate.name, vacancyTitle: vacancy1.title, stageLabel: stage1.name, when },
    });
  } else {
    console.log("Round-1 interview already exists -- skipped");
  }

  // Upcoming interview (3 days from now) -- round 2, no auto-email by design.
  const futureInterview = await prisma.interview.findFirst({
    where: { applicationId: application1.id, slot: { vacancyStageId: stage2.id } },
  });
  if (!futureInterview) {
    const futureDate = new Date(Date.now() + 3 * DAY_MS);
    futureDate.setHours(14, 30, 0, 0);
    const futureSlot = await prisma.interviewSlot.create({
      data: {
        vacancyStageId: stage2.id,
        scheduledAt: futureDate,
        panelists: { create: [{ userId: interviewer.id }, { userId: management.id }] },
      },
    });
    await prisma.interview.create({ data: { slotId: futureSlot.id, applicationId: application1.id } });
    console.log(`Created upcoming round-2 interview for "${candidate.name}" on "${vacancy1.title}"`);
  } else {
    console.log("Round-2 interview already exists -- skipped");
  }

  // --- Vacancy 2: Product Designer -- already concluded (HIRED), real offer
  //     email. Gives Applicant History a second row and Email History a
  //     second, differently-labeled entry. ---
  const vacancy2 = await ensureVacancy(
    "Product Designer",
    "Design",
    "We're hiring a product designer to help shape our next generation of tools."
  );
  let application2 = await prisma.candidateApplication.findUnique({
    where: { candidateId_vacancyId: { candidateId: candidate.id, vacancyId: vacancy2.id } },
  });
  if (!application2) {
    application2 = await prisma.candidateApplication.create({
      data: {
        candidateId: candidate.id,
        vacancyId: vacancy2.id,
        stage: "HIRED",
        hiringDecision: "HIRE",
        decidedByUserId: hiringManager.id,
        decidedAt: new Date(),
      },
    });
    console.log(`Applied + hired "${candidate.name}" on "${vacancy2.title}" (application id ${application2.id})`);
  }
  await sendOnceAndLog({
    actorUserId: hiringManager.id,
    entityType: "CandidateApplication",
    entityId: application2.id,
    recipient: candidate.email,
    reason: "hiring_decision_hire",
    vars: { candidateName: candidate.name, vacancyTitle: vacancy2.title },
  });

  console.log(
    `\nDone. Open Candidates, search "Noah Bennett", and open either application. ` +
      `Email History will show both real emails -- click a row to expand it.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
