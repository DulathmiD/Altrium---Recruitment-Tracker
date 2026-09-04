// SUPERSEDED by scripts/seed-full-demo.ts (see project-decisions-log.md's
// "Seventeenth pass") -- every vacancy it seeds already has a "Pending
// Feedback" candidate built in. Don't run this after seed-full-demo.ts; it
// adds a vacancy under a department name nothing else in the system
// recognizes. Left in place, unused, for reference only.
//
// Populates a self-contained vacancy, candidates, and two interviews so the
// Follow Ups page's "Pending Feedback" and "Calls" sections have something
// to show. Safe to re-run -- every lookup is find-or-create, so running it
// twice just reuses what's already there instead of erroring on a
// unique-constraint clash.
//
// What it creates:
//   - Vacancy "Customer Success Associate" / "Customer Service" (2 stages:
//     Technical Interview, Final Interview)
//   - The seeded interviewer (interviewer@altrium.com) assigned to its panel
//   - Candidate "Layla Haddad" (SHORTLISTED) with a past interview slot
//     (yesterday) and no feedback submitted yet -> shows under Pending
//     Feedback
//   - Candidate "Mateo Reyes" (SHORTLISTED, phone number set) with a future
//     interview slot (3 days from now) -> shows under Calls
//
// Run from the backend folder:
//   npx tsx scripts/seed-followups-screen.ts
import "dotenv/config";
import { prisma } from "../src/prisma.js";

const DAY_MS = 24 * 60 * 60 * 1000;

async function main() {
  const interviewer = await prisma.user.findUnique({ where: { email: "interviewer@altrium.com" } });
  if (!interviewer) {
    console.error('Could not find the seeded interviewer (interviewer@altrium.com). Run "npx prisma db seed" first.');
    process.exitCode = 1;
    return;
  }
  // Mateo's slot below is this vacancy's only configured stage's Final
  // Interview -- seeded compliant with checkFinalRoundHasManagement
  // (interview.controller.ts) even though this script bypasses that check.
  const mgmt = await prisma.user.findUnique({ where: { email: "management@altrium.com" } });
  if (!mgmt) {
    console.error('Could not find the seeded management user (management@altrium.com). Run "npx prisma db seed" first.');
    process.exitCode = 1;
    return;
  }

  let vacancy = await prisma.vacancy.findUnique({
    where: { title_department: { title: "Customer Success Associate", department: "Customer Service" } },
  });
  if (!vacancy) {
    vacancy = await prisma.vacancy.create({
      data: {
        title: "Customer Success Associate",
        department: "Customer Service",
        description: "We're hiring a customer success associate to help our clients get the most out of the product.",
        status: "OPEN",
      },
    });
    console.log(`Created vacancy "${vacancy.title}" (id ${vacancy.id})`);
  } else {
    console.log(`Reusing vacancy "${vacancy.title}" (id ${vacancy.id})`);
  }

  async function ensureStage(name: string, order: number) {
    const existing = await prisma.vacancyStage.findUnique({
      where: { vacancyId_order: { vacancyId: vacancy!.id, order } },
    });
    if (existing) return existing;
    return prisma.vacancyStage.create({ data: { vacancyId: vacancy!.id, name, order } });
  }
  const stage1 = await ensureStage("Technical Interview", 1);
  const stage2 = await ensureStage("Final Interview", 2);

  const existingPanelLink = await prisma.vacancyInterviewer.findUnique({
    where: { vacancyId_userId: { vacancyId: vacancy.id, userId: interviewer.id } },
  });
  if (!existingPanelLink) {
    await prisma.vacancyInterviewer.create({ data: { vacancyId: vacancy.id, userId: interviewer.id } });
    console.log(`Added ${interviewer.name} to the vacancy's interview panel`);
  }

  // Matches the filename convention used for the real CV PDFs dropped into
  // uploads/cvs/ for this script's candidates (see docs/project-decisions-log.md).
  function slugify(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  async function ensureCandidate(name: string, email: string, phoneNumber: string | null) {
    let candidate = await prisma.candidate.findUnique({ where: { email } });
    if (!candidate) {
      candidate = await prisma.candidate.create({
        data: { name, email, phoneNumber, cvUrl: `${slugify(name)}_cv.pdf` },
      });
      console.log(`Created candidate "${candidate.name}" <${candidate.email}>`);
    }

    let application = await prisma.candidateApplication.findUnique({
      where: { candidateId_vacancyId: { candidateId: candidate.id, vacancyId: vacancy!.id } },
    });
    if (!application) {
      application = await prisma.candidateApplication.create({
        data: {
          candidateId: candidate.id,
          vacancyId: vacancy!.id,
          stage: "SHORTLISTED",
          currentVacancyStageId: stage1.id,
        },
      });
      console.log(`  -> applied to "${vacancy!.title}" (application id ${application.id})`);
    }
    return { candidate, application };
  }

  // Pending Feedback candidate: interview slot in the past, no feedback submitted.
  const { application: pastApp } = await ensureCandidate("Layla Haddad", "layla.haddad@example.com", null);
  const existingPastInterview = await prisma.interview.findFirst({ where: { applicationId: pastApp.id } });
  if (!existingPastInterview) {
    // Shared with the HM/Leadership/Management seed scripts -- lands on the
    // same busy past day as their interviews instead of its own separate
    // "yesterday" so the Interviews calendar doesn't show an extra date.
    const pastInterviewDay = new Date(Date.now() - 12 * DAY_MS);
    pastInterviewDay.setHours(12, 15, 0, 0);
    const pastSlot = await prisma.interviewSlot.create({
      data: {
        vacancyStageId: stage1.id,
        scheduledAt: pastInterviewDay,
        panelists: { create: [{ userId: interviewer.id }] },
      },
    });
    await prisma.interview.create({ data: { slotId: pastSlot.id, applicationId: pastApp.id } });
    console.log("Created past interview (no feedback submitted) for Layla Haddad");
  } else {
    console.log("Layla Haddad already has an interview -- skipped");
  }

  // Calls candidate: interview slot in the future, phone number on file.
  const { application: futureApp } = await ensureCandidate("Mateo Reyes", "mateo.reyes@example.com", "+44 7700 900123");
  const existingFutureInterview = await prisma.interview.findFirst({ where: { applicationId: futureApp.id } });
  if (!existingFutureInterview) {
    const futureSlot = await prisma.interviewSlot.create({
      data: {
        vacancyStageId: stage2.id,
        scheduledAt: new Date(Date.now() + 3 * DAY_MS),
        panelists: { create: [{ userId: interviewer.id }, { userId: mgmt.id }] },
      },
    });
    await prisma.interview.create({ data: { slotId: futureSlot.id, applicationId: futureApp.id } });
    console.log("Created future interview (3 days from now, phone number set) for Mateo Reyes");
  } else {
    console.log("Mateo Reyes already has an interview -- skipped");
  }

  console.log("\nDone. Open the Follow Ups page to see Pending Feedback (Layla Haddad) and Calls (Mateo Reyes).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
