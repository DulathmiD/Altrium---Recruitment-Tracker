// SUPERSEDED by scripts/seed-full-demo.ts (see project-decisions-log.md's
// "Seventeenth pass") -- that script covers every role on HR's 8 canonical
// departments instead of this one's freeform ones. Don't run this after
// seed-full-demo.ts; it'll add a vacancy under a department name nothing
// else in the system recognizes. Left in place, unused, for reference only.
//
// Populates realistic recruitment data for the Management screens
// (Dashboard, Department Vacancies, Candidate Progress, Upcoming Interviews,
// Reports). Safe to re-run -- every lookup is find-or-create.
//
// Logs in as management@altrium.com / password123 (seeded by
// `npx prisma db seed`, department: Engineering) to see all of this.
//
// What it creates (2 vacancies in the Engineering department):
//   - "DevOps Engineer" (overdue target date, created 35 days ago so it also
//     trips the Vacancy Ageing nudge): one candidate ready for a decision,
//     one with a panelist's feedback still missing, one hired this month,
//     one rejected, plus a future interview for Upcoming Interviews.
//   - "QA Engineer" (comfortable target date, freshly created): a couple of
//     early-stage candidates for bulk in Recruitment Progress.
//
// Run from the backend folder:
//   npx tsx scripts/seed-management-screens.ts
import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../src/prisma.js";
import { Role, type RecruitmentStage } from "../generated/prisma/index.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEPARTMENT = "Engineering";

async function ensureUser(name: string, email: string, role: Role, department: string | null) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await bcrypt.hash("password123", 10);
    user = await prisma.user.create({ data: { name, email, passwordHash, role, department, isActive: true } });
    console.log(`Created ${role} user "${name}" <${email}>`);
  }
  return user;
}

async function ensureVacancy(title: string, description: string, targetFillDateOffsetDays: number, createdDaysAgo: number) {
  let vacancy = await prisma.vacancy.findUnique({ where: { title_department: { title, department: DEPARTMENT } } });
  if (!vacancy) {
    vacancy = await prisma.vacancy.create({
      data: {
        title,
        department: DEPARTMENT,
        description,
        status: "OPEN",
        targetFillDate: new Date(Date.now() + targetFillDateOffsetDays * DAY_MS),
        createdAt: new Date(Date.now() - createdDaysAgo * DAY_MS),
      },
    });
    console.log(`Created vacancy "${vacancy.title}" (id ${vacancy.id})`);
  } else {
    console.log(`Reusing vacancy "${vacancy.title}" (id ${vacancy.id})`);
  }
  return vacancy;
}

async function ensureStage(vacancyId: number, name: string, order: number) {
  const existing = await prisma.vacancyStage.findUnique({ where: { vacancyId_order: { vacancyId, order } } });
  if (existing) return existing;
  return prisma.vacancyStage.create({ data: { vacancyId, name, order } });
}

async function ensurePoolMember(vacancyId: number, userId: number) {
  const existing = await prisma.vacancyInterviewer.findUnique({ where: { vacancyId_userId: { vacancyId, userId } } });
  if (!existing) await prisma.vacancyInterviewer.create({ data: { vacancyId, userId } });
}

// Matches the filename convention used for the real CV PDFs dropped into
// uploads/cvs/ for this script's candidates (see docs/project-decisions-log.md).
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

async function ensureCandidate(name: string, email: string) {
  let candidate = await prisma.candidate.findUnique({ where: { email } });
  if (!candidate) {
    candidate = await prisma.candidate.create({ data: { name, email, cvUrl: `${slugify(name)}_cv.pdf` } });
    console.log(`  Created candidate "${name}"`);
  }
  return candidate;
}

async function ensureApplication(
  candidateId: number,
  vacancyId: number,
  stage: RecruitmentStage,
  currentVacancyStageId: number | null,
  appliedDaysAgo: number,
  extra: { hiringDecision?: "HIRE" | "REJECT"; decidedByUserId?: number; decidedAt?: Date } = {}
) {
  let application = await prisma.candidateApplication.findUnique({ where: { candidateId_vacancyId: { candidateId, vacancyId } } });
  if (!application) {
    application = await prisma.candidateApplication.create({
      data: {
        candidateId,
        vacancyId,
        stage,
        currentVacancyStageId,
        appliedAt: new Date(Date.now() - appliedDaysAgo * DAY_MS),
        ...extra,
      },
    });
  }
  return application;
}

async function ensureInterview(
  applicationId: number,
  vacancyStageId: number,
  scheduledAtOffsetDays: number,
  feedbackFrom: { userId: number; score: number; comments: string }[]
) {
  const existing = await prisma.interview.findFirst({ where: { applicationId, slot: { vacancyStageId } } });
  if (existing) return existing;

  const slot = await prisma.interviewSlot.create({
    data: {
      vacancyStageId,
      scheduledAt: new Date(Date.now() + scheduledAtOffsetDays * DAY_MS),
      panelists: { create: feedbackFrom.map((f) => ({ userId: f.userId })) },
    },
  });
  const interview = await prisma.interview.create({ data: { slotId: slot.id, applicationId } });

  for (const f of feedbackFrom.filter((f) => f.score >= 0)) {
    await prisma.feedback.create({ data: { interviewId: interview.id, interviewerId: f.userId, score: f.score, comments: f.comments } });
  }
  return interview;
}

// Explicit-time variant of ensureInterview, used for interviews pinned to
// the shared past interview day (see pastDay below) so multiple candidates
// across scripts land on the same calendar date at different times instead
// of each getting its own single-candidate day.
async function ensureInterviewAt(
  applicationId: number,
  vacancyStageId: number,
  scheduledAt: Date,
  feedbackFrom: { userId: number; score: number; comments: string }[]
) {
  const existing = await prisma.interview.findFirst({ where: { applicationId, slot: { vacancyStageId } } });
  if (existing) return existing;

  const slot = await prisma.interviewSlot.create({
    data: {
      vacancyStageId,
      scheduledAt,
      panelists: { create: feedbackFrom.map((f) => ({ userId: f.userId })) },
    },
  });
  const interview = await prisma.interview.create({ data: { slotId: slot.id, applicationId } });

  for (const f of feedbackFrom.filter((f) => f.score >= 0)) {
    await prisma.feedback.create({ data: { interviewId: interview.id, interviewerId: f.userId, score: f.score, comments: f.comments } });
  }
  return interview;
}

function atTime(day: Date, hours: number, minutes: number): Date {
  const d = new Date(day);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

async function main() {
  const mgmt = await prisma.user.findUnique({ where: { email: "management@altrium.com" } });
  if (!mgmt) {
    console.error('Could not find the seeded management user (management@altrium.com). Run "npx prisma db seed" first.');
    process.exitCode = 1;
    return;
  }
  if (mgmt.department !== DEPARTMENT) {
    console.warn(`Warning: management@altrium.com's department is "${mgmt.department}", not "${DEPARTMENT}" -- this data won't show up for them.`);
  }

  // Shared with the HM/Leadership/Follow-Ups seed scripts -- every
  // "already happened" interview across all of them lands on this same day,
  // each at its own staggered time, so the Interviews calendar shows one
  // clearly busy day instead of many scattered single-candidate days.
  const pastDay = new Date(Date.now() - 12 * DAY_MS);

  const panelistA = await ensureUser("Owen Fletcher", "owen.fletcher@example.com", Role.INTERVIEWER, DEPARTMENT);
  const panelistB = await ensureUser("Petra Vance", "petra.vance@example.com", Role.INTERVIEWER, DEPARTMENT);

  // ---- Vacancy 1: overdue target date + old enough to trip the ageing nudge ----
  const vac1 = await ensureVacancy(
    "DevOps Engineer",
    "We're hiring a DevOps engineer to own our deployment pipeline and cloud infrastructure.",
    -10,
    35
  );
  const vac1Stage1 = await ensureStage(vac1.id, "Technical Interview", 1);
  const vac1Stage2 = await ensureStage(vac1.id, "Final Interview", 2);
  await ensurePoolMember(vac1.id, panelistA.id);
  await ensurePoolMember(vac1.id, panelistB.id);

  // Ready for a decision (all feedback in).
  const kara = await ensureCandidate("Kara Lindqvist", "kara.lindqvist@example.com");
  const karaApp = await ensureApplication(kara.id, vac1.id, "SHORTLISTED", vac1Stage1.id, 6);
  await ensureInterviewAt(karaApp.id, vac1Stage1.id, atTime(pastDay, 11, 0), [
    { userId: panelistA.id, score: 8, comments: "Strong fundamentals." },
    { userId: panelistB.id, score: 8, comments: "Good communicator." },
  ]);

  // Interview happened, one panelist's feedback still missing -- overdue feedback nudge.
  const liam = await ensureCandidate("Liam Brennan", "liam.brennan@example.com");
  const liamApp = await ensureApplication(liam.id, vac1.id, "SHORTLISTED", vac1Stage1.id, 4);
  await ensureInterviewAt(liamApp.id, vac1Stage1.id, atTime(pastDay, 11, 45), [
    { userId: panelistA.id, score: 7, comments: "Solid, some gaps in testing knowledge." },
    { userId: panelistB.id, score: -1, comments: "" },
  ]);

  // Hired this month.
  const maya = await ensureCandidate("Maya Srinivasan", "maya.srinivasan@example.com");
  await ensureApplication(maya.id, vac1.id, "HIRED", vac1Stage2.id, 20, {
    hiringDecision: "HIRE",
    decidedByUserId: mgmt.id,
    decidedAt: new Date(),
  });

  // Rejected.
  const noah = await ensureCandidate("Noah Fitzgerald", "noah.fitzgerald@example.com");
  await ensureApplication(noah.id, vac1.id, "REJECTED", vac1Stage1.id, 12, {
    hiringDecision: "REJECT",
    decidedByUserId: mgmt.id,
    decidedAt: new Date(Date.now() - 2 * DAY_MS),
  });

  // Future interview -- shows on Upcoming Interviews. Also the seed data's
  // main demo of the final-round-must-include-Management rule (see
  // checkFinalRoundHasManagement in interview.controller.ts) and of
  // Management's own "My Candidates" tab, since mgmt is on the panel.
  const olga = await ensureCandidate("Olga Petrova", "olga.petrova@example.com");
  const olgaApp = await ensureApplication(olga.id, vac1.id, "SHORTLISTED", vac1Stage2.id, 8);
  await ensureInterview(olgaApp.id, vac1Stage2.id, 3, [
    { userId: panelistA.id, score: -1, comments: "" },
    { userId: mgmt.id, score: -1, comments: "" },
  ]);

  // ---- Vacancy 2: on track, freshly created ----
  const vac2 = await ensureVacancy(
    "QA Engineer",
    "We're hiring a QA engineer to build out automated test coverage across our web app.",
    45,
    2
  );
  const vac2Stage1 = await ensureStage(vac2.id, "Screening Interview", 1);
  await ensurePoolMember(vac2.id, panelistB.id);

  const priya = await ensureCandidate("Priya Balasubramaniam", "priya.balasubramaniam@example.com");
  await ensureApplication(priya.id, vac2.id, "SHORTLISTED", null, 1);
  const quentin = await ensureCandidate("Quentin Ashworth", "quentin.ashworth@example.com");
  await ensureApplication(quentin.id, vac2.id, "APPLIED", null, 0);

  console.log("\nDone. Log in as management@altrium.com / password123 to see:");
  console.log("  - Dashboard: KPIs, Recruitment Progress, Needs Attention (decision/feedback/ageing nudges)");
  console.log("  - Department Vacancies: 2 vacancies (Overdue + On track)");
  console.log("  - Candidate Progress: Stage Summary + Requires Attention table (Ready/Delayed rows)");
  console.log("  - Upcoming Interviews: Olga Petrova's final round, 3 days out");
  console.log("  - Reports: all 4 report types generate real PDFs from this data");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
