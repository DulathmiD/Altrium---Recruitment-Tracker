// SUPERSEDED by scripts/seed-full-demo.ts (see project-decisions-log.md's
// "Seventeenth pass") -- covers every role on HR's 8 canonical departments
// instead of this one's freeform ones. Don't run this after seed-full-demo.ts.
// Left in place, unused, for reference only.
//
// Populates realistic recruitment data for the Leadership screens
// (Recruitment Overview, Recruitment Progress, Department Performance,
// Hiring Trends, Export Reports). Safe to re-run -- every lookup is
// find-or-create.
//
// Logs in as leadership@altrium.com / password123 (seeded by
// `npx prisma db seed`, org-wide -- no department) to see all of this.
//
// What it creates, spread across 3 departments so Department Performance has
// something real to compare:
//   - Engineering: "Platform Engineer" (overdue target, 35 days old) with a
//     decision-ready candidate, a missing-feedback candidate, a hire, a
//     rejection and a future interview; "Associate Software Engineer"
//     (fresh) with a couple of early-stage candidates.
//   - Sales: one on-track vacancy with a hire and a rejection, for a second
//     data point in the department comparison.
//   - Marketing: one overdue vacancy with no hires yet, so it shows up as the
//     department with the worst fill rate / an overdue role and nothing in
//     Hiring Trends' hire counts.
//
// Run from the backend folder:
//   npx tsx scripts/seed-leadership-screens.ts
import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../src/prisma.js";
import { Role, type RecruitmentStage } from "../generated/prisma/index.js";

const DAY_MS = 24 * 60 * 60 * 1000;

async function ensureUser(name: string, email: string, role: Role, department: string | null) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await bcrypt.hash("password123", 10);
    user = await prisma.user.create({ data: { name, email, passwordHash, role, department, isActive: true } });
    console.log(`Created ${role} user "${name}" <${email}>`);
  }
  return user;
}

async function ensureVacancy(title: string, department: string, description: string, targetFillDateOffsetDays: number, createdDaysAgo: number) {
  let vacancy = await prisma.vacancy.findUnique({ where: { title_department: { title, department } } });
  if (!vacancy) {
    vacancy = await prisma.vacancy.create({
      data: {
        title,
        department,
        description,
        status: "OPEN",
        targetFillDate: new Date(Date.now() + targetFillDateOffsetDays * DAY_MS),
        createdAt: new Date(Date.now() - createdDaysAgo * DAY_MS),
      },
    });
    console.log(`Created vacancy "${vacancy.title}" (${department}, id ${vacancy.id})`);
  } else {
    console.log(`Reusing vacancy "${vacancy.title}" (${department}, id ${vacancy.id})`);
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
  const leadership = await prisma.user.findUnique({ where: { email: "leadership@altrium.com" } });
  if (!leadership) {
    console.error('Could not find the seeded leadership user (leadership@altrium.com). Run "npx prisma db seed" first.');
    process.exitCode = 1;
    return;
  }
  // Elise's final round below is seeded compliant with the final-round-must-
  // include-Management rule (checkFinalRoundHasManagement, interview.controller.ts)
  // even though this script's direct prisma writes bypass that check.
  const mgmt = await prisma.user.findUnique({ where: { email: "management@altrium.com" } });
  if (!mgmt) {
    console.error('Could not find the seeded management user (management@altrium.com). Run "npx prisma db seed" first.');
    process.exitCode = 1;
    return;
  }

  // Shared with the HM/Management/Follow-Ups seed scripts -- every
  // "already happened" interview across all of them lands on this same day,
  // each at its own staggered time, so the Interviews calendar shows one
  // clearly busy day instead of many scattered single-candidate days.
  const pastDay = new Date(Date.now() - 12 * DAY_MS);

  const panelistA = await ensureUser("Dana Torres", "dana.torres@example.com", Role.INTERVIEWER, "Engineering");
  const panelistB = await ensureUser("Eli Novak", "eli.novak@example.com", Role.INTERVIEWER, "Engineering");
  const panelistC = await ensureUser("Fay Delgado", "fay.delgado@example.com", Role.INTERVIEWER, "Sales");

  // ---- Engineering: overdue vacancy with a full spread of states ----
  const eng1 = await ensureVacancy(
    "Platform Engineer",
    "Engineering",
    "We're hiring a platform engineer to own our internal tooling and CI/CD infrastructure.",
    -10,
    35
  );
  const eng1Stage1 = await ensureStage(eng1.id, "Technical Interview", 1);
  const eng1Stage2 = await ensureStage(eng1.id, "Final Interview", 2);
  await ensurePoolMember(eng1.id, panelistA.id);
  await ensurePoolMember(eng1.id, panelistB.id);

  const amara = await ensureCandidate("Amara Okoye", "amara.okoye@example.com");
  const amaraApp = await ensureApplication(amara.id, eng1.id, "SHORTLISTED", eng1Stage1.id, 6);
  await ensureInterviewAt(amaraApp.id, eng1Stage1.id, atTime(pastDay, 9, 15), [
    { userId: panelistA.id, score: 8, comments: "Strong fundamentals." },
    { userId: panelistB.id, score: 8, comments: "Good communicator." },
  ]);

  const brandon = await ensureCandidate("Brandon Lee", "brandon.lee@example.com");
  const brandonApp = await ensureApplication(brandon.id, eng1.id, "SHORTLISTED", eng1Stage1.id, 4);
  await ensureInterviewAt(brandonApp.id, eng1Stage1.id, atTime(pastDay, 10, 15), [
    { userId: panelistA.id, score: 7, comments: "Solid, some gaps in testing knowledge." },
    { userId: panelistB.id, score: -1, comments: "" },
  ]);

  const camille = await ensureCandidate("Camille Dubois", "camille.dubois@example.com");
  await ensureApplication(camille.id, eng1.id, "HIRED", eng1Stage2.id, 20, {
    hiringDecision: "HIRE",
    decidedByUserId: leadership.id,
    decidedAt: new Date(),
  });

  const derek = await ensureCandidate("Derek Palmer", "derek.palmer@example.com");
  await ensureApplication(derek.id, eng1.id, "REJECTED", eng1Stage1.id, 12, {
    hiringDecision: "REJECT",
    decidedByUserId: leadership.id,
    decidedAt: new Date(Date.now() - 2 * DAY_MS),
  });

  const elise = await ensureCandidate("Elise Fontaine", "elise.fontaine@example.com");
  const eliseApp = await ensureApplication(elise.id, eng1.id, "SHORTLISTED", eng1Stage2.id, 8);
  await ensureInterview(eliseApp.id, eng1Stage2.id, 3, [
    { userId: panelistA.id, score: -1, comments: "" },
    { userId: mgmt.id, score: -1, comments: "" },
  ]);

  // ---- Engineering: on track, freshly created ----
  const eng2 = await ensureVacancy(
    "Associate Software Engineer",
    "Engineering",
    "We're hiring an associate software engineer to join our platform team as an early-career hire.",
    45,
    2
  );
  await ensureStage(eng2.id, "Screening Interview", 1);
  const finn = await ensureCandidate("Finn O'Brien", "finn.obrien@example.com");
  await ensureApplication(finn.id, eng2.id, "SHORTLISTED", null, 1);
  const grace = await ensureCandidate("Grace Muthoni", "grace.muthoni@example.com");
  await ensureApplication(grace.id, eng2.id, "APPLIED", null, 0);

  // ---- Sales: on track vacancy with one hire, one rejection ----
  const sales1 = await ensureVacancy(
    "Account Executive",
    "Sales",
    "We're hiring an account executive to manage our mid-market client relationships.",
    30,
    10
  );
  const sales1Stage1 = await ensureStage(sales1.id, "Panel Interview", 1);
  await ensurePoolMember(sales1.id, panelistC.id);

  const hugo = await ensureCandidate("Hugo Ramirez", "hugo.ramirez@example.com");
  await ensureApplication(hugo.id, sales1.id, "HIRED", sales1Stage1.id, 15, {
    hiringDecision: "HIRE",
    decidedByUserId: leadership.id,
    decidedAt: new Date(Date.now() - 5 * DAY_MS),
  });

  const isabel = await ensureCandidate("Isabel Duarte", "isabel.duarte@example.com");
  await ensureApplication(isabel.id, sales1.id, "REJECTED", sales1Stage1.id, 9, {
    hiringDecision: "REJECT",
    decidedByUserId: leadership.id,
    decidedAt: new Date(Date.now() - 4 * DAY_MS),
  });

  // ---- Marketing: overdue vacancy, nothing hired yet -- worst fill rate ----
  const mkt1 = await ensureVacancy(
    "Content Marketing Specialist",
    "Marketing",
    "We're hiring a content marketing specialist to grow our organic content and brand presence.",
    -5,
    40
  );
  await ensureStage(mkt1.id, "Portfolio Review", 1);
  const jonah = await ensureCandidate("Jonah Pierce", "jonah.pierce@example.com");
  await ensureApplication(jonah.id, mkt1.id, "APPLIED", null, 3);

  console.log("\nDone. Log in as leadership@altrium.com / password123 to see:");
  console.log("  - Recruitment Overview: org-wide KPIs, Recruitment Progress, Needs Attention (aggregate nudges)");
  console.log("  - Recruitment Progress: Stage Summary + Requires Attention table across Engineering/Sales/Marketing");
  console.log("  - Department Performance: fill rate / time-to-hire / hired-rejected bars across all 3 departments");
  console.log("  - Hiring Trends: KPI counts + hires-per-month line (Camille + Hugo this window)");
  console.log("  - Export Reports: all 4 org-wide report types generate real PDFs from this data");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
