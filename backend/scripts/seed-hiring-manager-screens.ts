// SUPERSEDED by scripts/seed-full-demo.ts (see project-decisions-log.md's
// "Seventeenth pass") -- covers every role on HR's 8 canonical departments
// instead of this one's freeform ones. Don't run this after seed-full-demo.ts.
// Left in place, unused, for reference only.
//
// Populates realistic recruitment data for the Hiring Manager screens
// (Dashboard, Vacancies, Vacancy Candidates drill-down, Candidate Decision
// page, Candidate Comparison, Pending Decisions). Safe to re-run -- every
// lookup is find-or-create, so running it twice reuses what's already there.
//
// Logs in as hiringmanager@altrium.com / password123 (seeded by
// `npx prisma db seed`) to see all of this.
//
// What it creates (4 vacancies under Harry Dawson, the seeded HM):
//   - "Backend Engineer" (Engineering, OVERDUE): a full spread of candidate
//     states -- one ready for a mid-round Proceed/Do Not Proceed decision,
//     one mid-round but not ready yet (interview not happened), one with
//     partial panel feedback (still "pending feedback"), one ready for a
//     final-round Hire/Reject decision, one already Hired, plus four more
//     candidates all interviewing on the same day at staggered times so the
//     Interviews calendar has a realistic busy day to click into.
//   - "Data Analyst" (Data, DELAYED): one ready-for-decision candidate plus
//     one fresh applicant (no interview yet).
//   - "Product Designer" (Design, ON_TRACK): 5 shortlisted candidates with
//     varying scores, for the Candidate Comparison ranking and score
//     distribution.
//   - "Support Specialist" (Support): every candidate already
//     HIRED/REJECTED -- exercises "allDecided" sinking to the bottom of the
//     Vacancies list.
//
// Run from the backend folder:
//   npx tsx scripts/seed-hiring-manager-screens.ts
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

async function ensureVacancy(title: string, department: string, description: string, targetFillDateOffsetDays: number | null) {
  let vacancy = await prisma.vacancy.findUnique({ where: { title_department: { title, department } } });
  if (!vacancy) {
    vacancy = await prisma.vacancy.create({
      data: {
        title,
        department,
        description,
        status: "OPEN",
        targetFillDate: targetFillDateOffsetDays === null ? null : new Date(Date.now() + targetFillDateOffsetDays * DAY_MS),
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
  hiringManagerId: number,
  stage: RecruitmentStage,
  currentVacancyStageId: number | null,
  appliedDaysAgo: number,
  extra: { hiringDecision?: "HIRE" | "REJECT"; decidedByUserId?: number; decidedAt?: Date } = {}
) {
  let application = await prisma.candidateApplication.findUnique({
    where: { candidateId_vacancyId: { candidateId, vacancyId } },
  });
  if (!application) {
    application = await prisma.candidateApplication.create({
      data: {
        candidateId,
        vacancyId,
        hiringManagerId,
        stage,
        currentVacancyStageId,
        appliedAt: new Date(Date.now() - appliedDaysAgo * DAY_MS),
        ...extra,
      },
    });
  }
  return application;
}

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
    await prisma.feedback.create({
      data: { interviewId: interview.id, interviewerId: f.userId, score: f.score, comments: f.comments },
    });
  }
  return interview;
}

function ensureInterview(
  applicationId: number,
  vacancyStageId: number,
  scheduledAtOffsetDays: number,
  feedbackFrom: { userId: number; score: number; comments: string }[]
) {
  return ensureInterviewAt(applicationId, vacancyStageId, new Date(Date.now() + scheduledAtOffsetDays * DAY_MS), feedbackFrom);
}

// The next Thursday from today, at 09:00 -- used as a shared interview day so
// the Interviews calendar has one date with several interviews at different
// times, instead of everything spread one-per-day.
function nextWeekday(targetDay: number): Date {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  const diff = (targetDay - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function atTime(day: Date, hours: number, minutes: number): Date {
  const d = new Date(day);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

async function main() {
  const hm = await prisma.user.findUnique({ where: { email: "hiringmanager@altrium.com" } });
  if (!hm) {
    console.error('Could not find the seeded hiring manager (hiringmanager@altrium.com). Run "npx prisma db seed" first.');
    process.exitCode = 1;
    return;
  }
  // The final-round-must-include-Management rule (interview.controller.ts,
  // checkFinalRoundHasManagement) is only enforced by the API, not by this
  // script's direct prisma writes -- but Devon's final round below is used
  // as an actual demo of a completed final round, so it's seeded compliant
  // anyway, and it doubles as data for Management's "My Candidates" tab.
  const mgmt = await prisma.user.findUnique({ where: { email: "management@altrium.com" } });
  if (!mgmt) {
    console.error('Could not find the seeded management user (management@altrium.com). Run "npx prisma db seed" first.');
    process.exitCode = 1;
    return;
  }

  const panelistA = await ensureUser("Priya Nathan", "priya.nathan@example.com", Role.INTERVIEWER, "Engineering");
  const panelistB = await ensureUser("Ravi Kapoor", "ravi.kapoor@example.com", Role.INTERVIEWER, "Engineering");

  // Every "already happened" interview across this script (and the
  // Leadership/Management/Follow-Ups seed scripts) is deliberately pinned to
  // this same shared past day, each at its own staggered time, so the
  // Interviews calendar shows one clearly busy day instead of many scattered
  // single-candidate days.
  const pastDay = new Date(Date.now() - 12 * DAY_MS);

  // ---- Vacancy A: full spread of candidate states, OVERDUE ----
  const vacA = await ensureVacancy(
    "Backend Engineer",
    "Engineering",
    "We're looking for a backend engineer to help scale our core platform services and mentor junior team members.",
    -5
  );
  const vacAStage1 = await ensureStage(vacA.id, "Technical Interview", 1);
  const vacAStage2 = await ensureStage(vacA.id, "System Design", 2);
  const vacAStage3 = await ensureStage(vacA.id, "Final Interview", 3);
  await ensurePoolMember(vacA.id, panelistA.id);
  await ensurePoolMember(vacA.id, panelistB.id);

  // Ready for a mid-round Proceed/Do Not Proceed decision.
  const alice = await ensureCandidate("Alice Mensah", "alice.mensah@example.com");
  const aliceApp = await ensureApplication(alice.id, vacA.id, hm.id, "SHORTLISTED", vacAStage1.id, 6);
  await ensureInterviewAt(aliceApp.id, vacAStage1.id, atTime(pastDay, 9, 0), [
    { userId: panelistA.id, score: 8, comments: "Strong system design, clear communication." },
    { userId: panelistB.id, score: 9, comments: "Excellent problem-solving under pressure." },
  ]);

  // Mid-round, interview not happened yet -- not ready, shows "in progress".
  const ben = await ensureCandidate("Ben Castillo", "ben.castillo@example.com");
  const benApp = await ensureApplication(ben.id, vacA.id, hm.id, "SHORTLISTED", vacAStage2.id, 4);
  await ensureInterview(benApp.id, vacAStage2.id, 3, [{ userId: panelistA.id, score: -1, comments: "" }]);

  // Interview happened, only one of two panelists has submitted feedback --
  // still "pending feedback", not ready for an HM decision yet.
  const cara = await ensureCandidate("Cara Whitfield", "cara.whitfield@example.com");
  const caraApp = await ensureApplication(cara.id, vacA.id, hm.id, "SHORTLISTED", vacAStage1.id, 3);
  await ensureInterviewAt(caraApp.id, vacAStage1.id, atTime(pastDay, 9, 45), [
    { userId: panelistA.id, score: 7, comments: "Solid coding round, minor testing gaps." },
    { userId: panelistB.id, score: -1, comments: "" },
  ]);

  // Ready for a final-round Hire/Reject decision -- has feedback for every
  // round including the last one.
  const devon = await ensureCandidate("Devon Walsh", "devon.walsh@example.com");
  const devonApp = await ensureApplication(devon.id, vacA.id, hm.id, "SHORTLISTED", vacAStage3.id, 14);
  await ensureInterviewAt(devonApp.id, vacAStage1.id, atTime(pastDay, 10, 30), [
    { userId: panelistA.id, score: 8, comments: "Strong technical fundamentals." },
    { userId: panelistB.id, score: 8, comments: "Confident and clear." },
  ]);
  await ensureInterviewAt(devonApp.id, vacAStage2.id, atTime(pastDay, 11, 15), [
    { userId: panelistA.id, score: 9, comments: "Excellent system design tradeoffs." },
    { userId: panelistB.id, score: 8, comments: "Good depth on scaling questions." },
  ]);
  await ensureInterviewAt(devonApp.id, vacAStage3.id, atTime(pastDay, 13, 0), [
    { userId: panelistA.id, score: 9, comments: "Great culture fit, strong final round." },
    { userId: panelistB.id, score: 9, comments: "Would be a great addition to the team." },
    { userId: mgmt.id, score: 9, comments: "Aligned with the team's growth plans, happy to proceed." },
    // HM is also assignable as a panelist (ASSIGNABLE_ROLES in
    // staff.controller.ts) -- doubles as the only demo data for HM's own
    // new "My Candidates" tab.
    { userId: hm.id, score: 8, comments: "Confident this is the right hire for the team." },
  ]);

  // Already hired -- keeps vacA active (not allDecided) since other
  // candidates are still in progress, but exercises the Hired state.
  const elena = await ensureCandidate("Elena Kim", "elena.kim@example.com");
  await ensureApplication(elena.id, vacA.id, hm.id, "HIRED", vacAStage3.id, 20, {
    hiringDecision: "HIRE",
    decidedByUserId: hm.id,
    decidedAt: new Date(Date.now() - 1 * DAY_MS),
  });

  // A single busy interview day: 4 more candidates, same Technical Interview
  // stage, same upcoming Thursday, staggered through the day -- gives the
  // Interviews calendar a realistic multi-interview day to click into.
  const interviewDay = nextWeekday(4); // 4 = Thursday
  const busyDaySlots: { name: string; email: string; hour: number; minute: number }[] = [
    { name: "Grace Odhiambo", email: "grace.odhiambo@example.com", hour: 9, minute: 30 },
    { name: "Marcus Bellamy", email: "marcus.bellamy@example.com", hour: 11, minute: 0 },
    { name: "Sofia Marchetti", email: "sofia.marchetti@example.com", hour: 13, minute: 30 },
    { name: "Tomasz Nowak", email: "tomasz.nowak@example.com", hour: 15, minute: 45 },
  ];
  for (const slot of busyDaySlots) {
    const candidate = await ensureCandidate(slot.name, slot.email);
    const application = await ensureApplication(candidate.id, vacA.id, hm.id, "SHORTLISTED", vacAStage1.id, 5);
    await ensureInterviewAt(application.id, vacAStage1.id, atTime(interviewDay, slot.hour, slot.minute), [
      { userId: panelistA.id, score: -1, comments: "" },
      { userId: panelistB.id, score: -1, comments: "" },
    ]);
  }

  // ---- Vacancy B: DELAYED, one ready decision + one fresh applicant ----
  const vacB = await ensureVacancy(
    "Data Analyst",
    "Data",
    "We're hiring a data analyst to partner with product and finance teams on reporting and experimentation.",
    5
  );
  const vacBStage1 = await ensureStage(vacB.id, "Case Study Interview", 1);
  await ensureStage(vacB.id, "Final Interview", 2);
  await ensurePoolMember(vacB.id, panelistA.id);

  const farah = await ensureCandidate("Farah Osei", "farah.osei@example.com");
  const farahApp = await ensureApplication(farah.id, vacB.id, hm.id, "SHORTLISTED", vacBStage1.id, 3);
  await ensureInterviewAt(farahApp.id, vacBStage1.id, atTime(pastDay, 13, 45), [
    { userId: panelistA.id, score: 7, comments: "Good analytical approach, could be faster with SQL." },
  ]);

  const gus = await ensureCandidate("Gus Whitaker", "gus.whitaker@example.com");
  await ensureApplication(gus.id, vacB.id, hm.id, "APPLIED", null, 1);

  // ---- Vacancy C: ON_TRACK, several scored candidates for Comparison ----
  const vacC = await ensureVacancy(
    "Product Designer",
    "Design",
    "We're hiring a product designer to own end-to-end design for our customer-facing web app.",
    45
  );
  const vacCStage1 = await ensureStage(vacC.id, "Portfolio Review", 1);
  await ensurePoolMember(vacC.id, panelistB.id);

  const designCandidates: { name: string; email: string; score: number; comments: string; hour: number; minute: number }[] = [
    { name: "Nina Alvarez", email: "nina.alvarez@example.com", score: 9, comments: "Outstanding portfolio, strong storytelling.", hour: 14, minute: 30 },
    { name: "Omar Haddad", email: "omar.haddad@example.com", score: 8, comments: "Solid craft, good systems thinking.", hour: 15, minute: 0 },
    { name: "Preeti Nair", email: "preeti.nair@example.com", score: 8, comments: "Great attention to detail.", hour: 15, minute: 30 },
    { name: "Quinn Baxter", email: "quinn.baxter@example.com", score: 7, comments: "Good fundamentals, portfolio a bit thin.", hour: 16, minute: 0 },
    { name: "Rui Tanaka", email: "rui.tanaka@example.com", score: 6, comments: "Promising but needs more experience.", hour: 16, minute: 30 },
  ];
  for (const dc of designCandidates) {
    const candidate = await ensureCandidate(dc.name, dc.email);
    const app = await ensureApplication(candidate.id, vacC.id, hm.id, "SHORTLISTED", vacCStage1.id, 2);
    await ensureInterviewAt(app.id, vacCStage1.id, atTime(pastDay, dc.hour, dc.minute), [
      { userId: panelistB.id, score: dc.score, comments: dc.comments },
    ]);
  }

  // ---- Vacancy D: everyone already decided -- exercises allDecided sinking
  // to the bottom of the Vacancies list ----
  const vacD = await ensureVacancy(
    "Support Specialist",
    "Support",
    "We're hiring a support specialist to help our customers get the most out of the product.",
    30
  );
  const vacDStage1 = await ensureStage(vacD.id, "Screening Call", 1);
  await ensurePoolMember(vacD.id, panelistA.id);

  const hank = await ensureCandidate("Hank Sullivan", "hank.sullivan@example.com");
  await ensureApplication(hank.id, vacD.id, hm.id, "HIRED", vacDStage1.id, 15, {
    hiringDecision: "HIRE",
    decidedByUserId: hm.id,
    decidedAt: new Date(Date.now() - 5 * DAY_MS),
  });

  const ivy = await ensureCandidate("Ivy Chen", "ivy.chen@example.com");
  await ensureApplication(ivy.id, vacD.id, hm.id, "REJECTED", vacDStage1.id, 10, {
    hiringDecision: "REJECT",
    decidedByUserId: hm.id,
    decidedAt: new Date(Date.now() - 4 * DAY_MS),
  });

  // Still-in-progress, scored candidates for this vacancy so Candidate
  // Comparison has something to show when "Support Specialist" is selected
  // (Hank and Ivy above are both already decided, so they don't count).
  const supportCandidates: { name: string; email: string; score: number; comments: string; hour: number; minute: number }[] = [
    { name: "Jasper Wells", email: "jasper.wells@example.com", score: 8, comments: "Excellent customer empathy, fast learner.", hour: 16, minute: 45 },
    { name: "Keisha Bryant", email: "keisha.bryant@example.com", score: 7, comments: "Solid communication, some process gaps.", hour: 17, minute: 0 },
    { name: "Leo Marchetti", email: "leo.marchetti@example.com", score: 6, comments: "Good attitude, needs more product knowledge.", hour: 17, minute: 15 },
  ];
  for (const sc of supportCandidates) {
    const candidate = await ensureCandidate(sc.name, sc.email);
    const app = await ensureApplication(candidate.id, vacD.id, hm.id, "SHORTLISTED", vacDStage1.id, 2);
    await ensureInterviewAt(app.id, vacDStage1.id, atTime(pastDay, sc.hour, sc.minute), [
      { userId: panelistA.id, score: sc.score, comments: sc.comments },
    ]);
  }

  console.log("\nDone. Log in as hiringmanager@altrium.com / password123 to see:");
  console.log("  - Dashboard: KPI counts, Recruitment Progress, Needs Attention");
  console.log("  - Vacancies: 4 vacancies (Overdue/Delayed/On track + one mostly-decided)");
  console.log("  - Vacancy Candidates + Candidate Decision pages: click into any vacancy, then any candidate");
  console.log("  - Pending Decisions: Alice Mensah, Devon Walsh, Farah Osei");
  console.log("  - Candidate Comparison: \"Product Designer\" or \"Support Specialist\" from the dropdown");
  console.log(`  - Interviews calendar: ${pastDay.toDateString()} has a full day of past interviews; ${interviewDay.toDateString()} has 4 upcoming ones`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
