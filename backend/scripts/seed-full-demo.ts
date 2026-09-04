// Full system reset + rebuild: replaces the older scattered seed scripts
// (seed-hiring-manager-screens.ts, seed-leadership-screens.ts,
// seed-management-screens.ts, seed-hr-department-vacancies.ts,
// seed-followups-screen.ts) with ONE consolidated script covering every page
// across every role, on HR's 8 canonical departments (HR, Finance and
// Accounting, Operations, Marketing, Sales, IT, Customer Service, Legal) --
// see project-decisions-log.md's "Seventeenth pass" for why those older
// scripts' freeform departments (Engineering/Data/Design/Support) never
// lined up with HR's own department taxonomy. The older scripts are left in
// place (not deleted) but are superseded -- don't run them after this one,
// their data would just sit under departments nothing else recognizes.
//
// IMPORTANT: run `npx tsx scripts/wipe-candidates.ts` FIRST. This script is
// idempotent (find-or-create, safe to re-run) but it does not delete
// anything -- if old vacancies/candidates are still there from a previous
// script, you'll end up with both old and new data mixed together.
//
// Run from the backend folder, in this order:
//   npx tsx scripts/wipe-candidates.ts
//   npx prisma db seed                    (re-applies the department fix below)
//   npx tsx scripts/seed-full-demo.ts
//
// What this creates:
//   - 16 vacancies, 2 per department, spanning On Track/Delayed/Overdue fill
//     status and every pipeline stage (fresh applied, mid-round not-ready,
//     mid-round partial-feedback, ready-for-decision, final-round ready,
//     hired, rejected).
//   - "Backend Engineer" (IT) and "Content Marketing Specialist" (Marketing)
//     get extra scored candidates for Candidate Comparison.
//   - "Support Team Lead" (Customer Service) is fully decided (allDecided).
//   - hiringmanager@altrium.com is the hiring manager on every application
//     (spans all 8 departments, matching the existing "one HM's vacancies
//     can span multiple departments" decision).
//   - interviewer@altrium.com (Ian Foster) panelists on interviews across
//     every department, so their own My Interviews/My Candidates/Feedback
//     pages are populated, not just the throwaway panelist accounts.
//   - management@altrium.com is scoped to "IT" (see prisma/seed.ts) and
//     panelists on IT's final rounds, per the Management-must-attend-final-
//     round rule.
//   - leadership@altrium.com needs no direct seeding -- its pages aggregate
//     everything above automatically (org-wide, read-only).
//   - A handful of AuditLog rows (one per wired event type) and Notification
//     rows for every real staff account, so IT Admin's Audit Logs page and
//     everyone's notification bell have real content too (seeding writes
//     directly via Prisma, bypassing the controllers that normally create
//     these as a side effect of real actions).
import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../src/prisma.js";
import { Role, type RecruitmentStage } from "../generated/prisma/index.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Shared helpers -- same find-or-create shape as the existing seed scripts.
// ---------------------------------------------------------------------------

async function ensureUser(name: string, email: string, role: Role, department: string | null) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await bcrypt.hash("password123", 10);
    user = await prisma.user.create({ data: { name, email, passwordHash, role, department, isActive: true } });
    console.log(`Created ${role} user "${name}" <${email}>`);
  }
  return user;
}

async function mustGetUser(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`Could not find seeded user ${email} -- run "npx prisma db seed" first.`);
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
    console.log(`Created vacancy "${vacancy.title}" (${department}, id ${vacancy.id})`);
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

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function emailFor(name: string): string {
  return `${slugify(name).replace(/_/g, ".")}@example.com`;
}

async function ensureCandidate(name: string) {
  const email = emailFor(name);
  let candidate = await prisma.candidate.findUnique({ where: { email } });
  if (!candidate) {
    candidate = await prisma.candidate.create({ data: { name, email, cvUrl: `${slugify(name)}_cv.pdf` } });
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

async function ensureAuditLog(userId: number, action: string, entityType: string, entityId: number | null, daysAgo: number) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      createdAt: new Date(Date.now() - daysAgo * DAY_MS),
    },
  });
}

async function ensureNotification(userId: number, type: string, message: string, link: string | null, daysAgo: number, read: boolean) {
  await prisma.notification.create({
    data: { userId, type, message, link, read, createdAt: new Date(Date.now() - daysAgo * DAY_MS) },
  });
}

// ---------------------------------------------------------------------------
// Realistic candidate name pool -- 130 distinct names, enough headroom for
// every vacancy's full archetype spread (~117 candidates total) plus the two
// Comparison-boosted vacancies.
// ---------------------------------------------------------------------------

const NAME_POOL = [
  "Priya Sharma", "Marcus Chen", "Sofia Rodriguez", "James O'Connor", "Aisha Mohammed",
  "Daniel Kim", "Emma Thompson", "Lucas Silva", "Fatima Al-Rashid", "Ryan Murphy",
  "Yuki Tanaka", "Isabella Rossi", "Noah Anderson", "Chloe Dubois", "Ahmed Hassan",
  "Olivia Bennett", "Wei Zhang", "Grace Mwangi", "Ethan Walsh", "Mia Fernandez",
  "Kwame Asante", "Charlotte Lee", "Diego Morales", "Amara Okafor", "Liam Sullivan",
  "Nadia Petrov", "Samuel Osei", "Hannah Fitzgerald", "Arjun Patel", "Zara Ahmed",
  "Connor Reilly", "Leilani Kahale", "Viktor Novak", "Priyanka Rao", "Jack Donovan",
  "Amina Diallo", "Tobias Weber", "Camila Torres", "Felix Brandt", "Ingrid Larsen",
  "Malik Johnson", "Elena Popescu", "Hiroshi Sato", "Naledi Dlamini", "Sean Kavanagh",
  "Layla Haddad", "Owen Fitzpatrick", "Rania Khoury", "Cormac Byrne", "Sana Malik",
  "Adebayo Adeyemi", "Freya Nilsson", "Theo Kovacs", "Mei Lin", "Gabriel Santos",
  "Amelia Clarke", "Rahul Verma", "Ingrid Bergstrom", "Bashir Nkurunziza", "Poppy Whitfield",
  "Andres Villanueva", "Kiri Ngata", "Youssef Mansour", "Bianca Ferreira", "Callum Stewart",
  "Divya Menon", "Erik Johansson", "Naomi Okonkwo", "Pedro Alvarez", "Selin Yildiz",
  "Miles Cartwright", "Anika Larsson", "Tariq Farouk", "Willow Bennett", "Kenji Watanabe",
  "Delphine Laurent", "Kofi Mensah", "Rosalind Blackwood", "Idris Bakr", "Saoirse Kelly",
  "Anton Volkov", "Thandiwe Moyo", "Rowan Ellison", "Meera Chandran", "Julian Voss",
  "Ines Almeida", "Declan Foley", "Zainab Bello", "Kai Nakamura", "Esme Radcliffe",
  "Farida Nasser", "Callan O'Brien", "Ingrid Halvorsen", "Tunde Bakare", "Marisol Jimenez",
  "Piotr Kaminski", "Aaliyah Brooks", "Renzo Diaz", "Sigrid Eriksen", "Chidi Eze",
  "Marguerite Fontaine", "Osman Yilmaz", "Beatrix Somogyi", "Lindiwe Khumalo", "Nikolai Petrenko",
  "Amara Chukwu", "Soren Dahl", "Priscilla Wamalwa", "Faisal Rahman", "Odette Moreau",
  "Benedict Okoro", "Larissa Petrov", "Hamza Siddiqui", "Wren Alderton", "Consuelo Reyes",
  "Torvald Nystrom", "Amadi Obi", "Perpetua Nwosu", "Lachlan Munro", "Yasmin Farouk",
  "Bartholomew Quinn", "Adaeze Nnamdi", "Casimir Wojcik", "Rosalie Beaumont", "Ekon Adeyinka",
];
let namePoolIndex = 0;
function nextCandidateName(): string {
  if (namePoolIndex >= NAME_POOL.length) {
    // Safety net so a scope increase later never crashes instead of just
    // looking a little repetitive.
    namePoolIndex++;
    return `Extra Candidate ${namePoolIndex - NAME_POOL.length}`;
  }
  return NAME_POOL[namePoolIndex++]!;
}

// ---------------------------------------------------------------------------
// Vacancy specs -- 2 per department, on HR's 8 canonical departments.
// fillOffsetDays: negative = overdue, 1-7 = delayed, >7 = on track, null = no target.
// ---------------------------------------------------------------------------

type VacancySpec = {
  dept: string;
  title: string;
  description: string;
  fillOffsetDays: number | null;
  stages: string[];
  comparisonBoost?: boolean;
  allDecided?: boolean;
};

const VACANCY_SPECS: VacancySpec[] = [
  { dept: "HR", title: "HR Business Partner", description: "Partner with department leads on hiring plans, performance processes, and employee relations.", fillOffsetDays: -4, stages: ["Initial Interview", "Final Interview"], comparisonBoost: true },
  { dept: "HR", title: "Talent Acquisition Specialist", description: "Own full-cycle recruiting for our fastest-growing teams, from sourcing through offer.", fillOffsetDays: 35, stages: ["Screening Call", "Panel Interview"], comparisonBoost: true },

  { dept: "Finance and Accounting", title: "Senior Financial Analyst", description: "Lead monthly forecasting and variance analysis, partnering closely with department heads.", fillOffsetDays: 5, stages: ["Case Study Interview", "Final Interview"], comparisonBoost: true },
  { dept: "Finance and Accounting", title: "Accounts Payable Coordinator", description: "Manage the full AP cycle, vendor relationships, and month-end close support.", fillOffsetDays: 50, stages: ["Screening Call"], comparisonBoost: true },

  { dept: "Operations", title: "Operations Manager", description: "Own day-to-day operational performance across our fulfilment and logistics teams.", fillOffsetDays: -10, stages: ["Initial Interview", "Panel Interview", "Final Interview"], comparisonBoost: true },
  { dept: "Operations", title: "Supply Chain Analyst", description: "Analyse supplier performance and inventory data to improve forecasting accuracy.", fillOffsetDays: 40, stages: ["Case Study Interview"], comparisonBoost: true },

  { dept: "Marketing", title: "Content Marketing Specialist", description: "Plan and produce content across blog, social, and email to drive qualified pipeline.", fillOffsetDays: 20, stages: ["Portfolio Review", "Final Interview"], comparisonBoost: true },
  { dept: "Marketing", title: "Brand Manager", description: "Own brand strategy and creative direction across every customer-facing touchpoint.", fillOffsetDays: 6, stages: ["Portfolio Review"], comparisonBoost: true },

  { dept: "Sales", title: "Account Executive", description: "Own the full sales cycle for mid-market accounts, from first call to close.", fillOffsetDays: 30, stages: ["Role Play Interview", "Final Interview"], comparisonBoost: true },
  { dept: "Sales", title: "Sales Development Representative", description: "Generate and qualify pipeline for the Account Executive team through outbound outreach.", fillOffsetDays: -8, stages: ["Screening Call"], comparisonBoost: true },

  { dept: "IT", title: "Backend Engineer", description: "Help scale our core platform services and mentor junior engineers on the team.", fillOffsetDays: -6, stages: ["Technical Interview", "System Design", "Final Interview"], comparisonBoost: true },
  { dept: "IT", title: "IT Support Specialist", description: "Provide first- and second-line support across hardware, software, and network issues.", fillOffsetDays: 25, stages: ["Screening Call", "Final Interview"], comparisonBoost: true },

  { dept: "Customer Service", title: "Customer Success Manager", description: "Own renewal and expansion relationships for our largest accounts.", fillOffsetDays: 4, stages: ["Initial Interview", "Final Interview"], comparisonBoost: true },
  // Support Team Lead is allDecided (below) -- seedVacancyPipeline returns
  // before ever reaching the comparisonBoost block for allDecided vacancies
  // (every candidate is already HIRED/REJECTED, none stay SHORTLISTED), so
  // adding comparisonBoost here would be a silent no-op. Left off on purpose.
  { dept: "Customer Service", title: "Support Team Lead", description: "Lead a team of support specialists and own our first-response SLA.", fillOffsetDays: 45, stages: ["Screening Call"], allDecided: true },

  { dept: "Legal", title: "Corporate Counsel", description: "Advise the business on commercial contracts, compliance, and risk.", fillOffsetDays: 60, stages: ["Initial Interview", "Final Interview"], comparisonBoost: true },
  { dept: "Legal", title: "Contracts Administrator", description: "Manage the contract lifecycle from drafting through renewal across every department.", fillOffsetDays: -3, stages: ["Screening Call"], comparisonBoost: true },
];
// Corrections doc: Candidate Comparison should show the top 5, not 2.
// comparisonBoost started on only 2 of these 16 vacancies (Marketing, IT),
// then widened to one per department -- still left it ambiguous which
// vacancy to check to see 5. Now on every non-allDecided vacancy (15 of 16)
// so Candidate Comparison shows 5 candidates no matter which one is opened.

// ---------------------------------------------------------------------------
// Per-vacancy pipeline builder -- every archetype a page anywhere in the
// system needs to demonstrate, generated from one shared shape instead of
// hand-written per vacancy.
// ---------------------------------------------------------------------------

const pastDay = new Date(Date.now() - 12 * DAY_MS);

async function seedVacancyPipeline(
  vac: { id: number },
  stages: { id: number }[],
  hm: { id: number },
  interviewer: { id: number },
  panelist2: { id: number },
  mgmt: { id: number } | null,
  spec: VacancySpec
) {
  const lastStage = stages[stages.length - 1]!;

  if (spec.allDecided) {
    // Every candidate on this vacancy is already HIRED/REJECTED -- exercises
    // "allDecided" sinking to the bottom of the Vacancies list everywhere.
    // Each still gets one real round of feedback backing its decision
    // (single-stage vacancy here, so just the one round) -- same reasoning
    // as archetypes 6/7 below: nobody gets hired or rejected with zero
    // recorded feedback.
    const outcomes: ("HIRE" | "REJECT")[] = ["HIRE", "REJECT", "REJECT"];
    const outcomeFeedback: { userId: number; score: number; comments: string }[][] = [
      [
        { userId: interviewer.id, score: 9, comments: "Outstanding across the board, easy hire." },
        { userId: panelist2.id, score: 9, comments: "Best candidate we've seen for this role." },
      ],
      [
        { userId: interviewer.id, score: 4, comments: "Struggled with core questions, several gaps." },
        { userId: panelist2.id, score: 5, comments: "Below the bar for this role, wouldn't advance." },
      ],
      [
        { userId: interviewer.id, score: 5, comments: "Mixed round, some concerns about depth." },
        { userId: panelist2.id, score: 4, comments: "Not quite what we need for this role." },
      ],
    ];
    for (let i = 0; i < outcomes.length; i++) {
      const outcome = outcomes[i]!;
      const name = nextCandidateName();
      const candidate = await ensureCandidate(name);
      const app = await ensureApplication(candidate.id, vac.id, hm.id, outcome === "HIRE" ? "HIRED" : "REJECTED", lastStage.id, 18 + i, {
        hiringDecision: outcome,
        decidedByUserId: hm.id,
        decidedAt: new Date(Date.now() - (5 - i) * DAY_MS),
      });
      await ensureInterviewAt(app.id, lastStage.id, atTime(pastDay, 15 + i, 0), outcomeFeedback[i]!);
    }
    return;
  }

  // 1. Fresh applied, no interview yet -- HR's Follow Ups "Pending CV Review".
  const freshName = nextCandidateName();
  const fresh = await ensureCandidate(freshName);
  await ensureApplication(fresh.id, vac.id, hm.id, "APPLIED", null, 1);

  // 2. Mid-round, interview scheduled but hasn't happened -- not ready yet.
  const nrName = nextCandidateName();
  const nr = await ensureCandidate(nrName);
  const nrApp = await ensureApplication(nr.id, vac.id, hm.id, "SHORTLISTED", stages[0]!.id, 4);
  await ensureInterview(nrApp.id, stages[0]!.id, 3, [{ userId: interviewer.id, score: -1, comments: "" }]);

  // 3. Interview happened, only one panelist has submitted feedback --
  // HR's Follow Ups "Pending Feedback".
  const pfName = nextCandidateName();
  const pf = await ensureCandidate(pfName);
  const pfApp = await ensureApplication(pf.id, vac.id, hm.id, "SHORTLISTED", stages[0]!.id, 3);
  await ensureInterviewAt(pfApp.id, stages[0]!.id, atTime(pastDay, 9, 0), [
    { userId: interviewer.id, score: 7, comments: "Good first impression, clear and confident answers." },
    { userId: panelist2.id, score: -1, comments: "" },
  ]);

  // 4. Full feedback at round 1 -- ready for an HM decision.
  const rdName = nextCandidateName();
  const rd = await ensureCandidate(rdName);
  const rdApp = await ensureApplication(rd.id, vac.id, hm.id, "SHORTLISTED", stages[0]!.id, 6);
  await ensureInterviewAt(rdApp.id, stages[0]!.id, atTime(pastDay, 9, 45), [
    { userId: interviewer.id, score: 8, comments: "Strong communicator, thorough answers." },
    { userId: panelist2.id, score: 8, comments: "Would recommend advancing to the next round." },
  ]);

  // 5. Full feedback through every round, ending at the final round -- ready
  // for a final Hire/Reject decision. Only built when there's more than one
  // round to walk through.
  //
  // Corrections doc, reversed: an earlier pass added hm.id to this panel
  // (see project-decisions-log.md's "Twenty-first pass") to fix "Hiring
  // Manager doesn't have any interviews". User then clarified the actual
  // product decision: the HM isn't an interviewer and shouldn't have an
  // interviews page at all -- their role is deciding Proceed/Do Not
  // Proceed/Hire/Reject from Pending Decisions, not sitting on panels. The
  // HM Dashboard's "My Interviews" nav item/page/route was removed to match
  // (see HMLayout.tsx/App.tsx), so hm.id no longer belongs in any panel here
  // -- reverted back out entirely, not just re-gated behind mgmt.
  if (stages.length > 1) {
    const frName = nextCandidateName();
    const fr = await ensureCandidate(frName);
    const frApp = await ensureApplication(fr.id, vac.id, hm.id, "SHORTLISTED", lastStage.id, 14);
    for (let i = 0; i < stages.length; i++) {
      const isFinal = i === stages.length - 1;
      const panel =
        isFinal
          ? [
              { userId: interviewer.id, score: 8, comments: "Consistently strong across every round." },
              { userId: panelist2.id, score: 8, comments: "Great culture fit, confident final round." },
              ...(mgmt ? [{ userId: mgmt.id, score: 9, comments: "Aligned with the team's plans, happy to proceed." }] : []),
            ]
          : [
              { userId: interviewer.id, score: 8, comments: "Strong round, clear depth." },
              { userId: panelist2.id, score: 7, comments: "Solid, a couple of minor gaps." },
            ];
      await ensureInterviewAt(frApp.id, stages[i]!.id, atTime(pastDay, 10 + i, 30), panel);
    }

    // 5b. Same final-round-ready state, but Management's own feedback is
    // still missing -- gives Management's "My Candidates" tab a "Pending"
    // row to show alongside the "Submitted" one from #5 above (their own
    // department's final rounds only -- see mgmt being null everywhere else).
    if (mgmt) {
      const pmName = nextCandidateName();
      const pm = await ensureCandidate(pmName);
      const pmApp = await ensureApplication(pm.id, vac.id, hm.id, "SHORTLISTED", lastStage.id, 12);
      for (let i = 0; i < stages.length; i++) {
        const isFinal = i === stages.length - 1;
        const panel = isFinal
          ? [
              { userId: interviewer.id, score: 7, comments: "Solid final round, good depth." },
              { userId: panelist2.id, score: 8, comments: "Confident, would bring them on." },
              { userId: mgmt.id, score: -1, comments: "" },
            ]
          : [
              { userId: interviewer.id, score: 7, comments: "Good round overall." },
              { userId: panelist2.id, score: 7, comments: "Solid, no major concerns." },
            ];
        await ensureInterviewAt(pmApp.id, stages[i]!.id, atTime(pastDay, 12 + i, 30), panel);
      }
    }
  }

  // 6. Already hired -- walks every round with real, positive feedback
  // (previously had none at all, so their Panel Feedback page showed "No
  // panel feedback recorded yet." under an "already hired" banner, which
  // doesn't happen in real recruiting -- nobody gets hired with zero
  // recorded feedback. Mirrors archetype 5's per-round shape.
  const hName = nextCandidateName();
  const hCand = await ensureCandidate(hName);
  const hApp = await ensureApplication(hCand.id, vac.id, hm.id, "HIRED", lastStage.id, 20, {
    hiringDecision: "HIRE",
    decidedByUserId: hm.id,
    decidedAt: new Date(Date.now() - 2 * DAY_MS),
  });
  for (let i = 0; i < stages.length; i++) {
    const isFinal = i === stages.length - 1;
    const panel =
      isFinal
        ? [
            { userId: interviewer.id, score: 9, comments: "Outstanding across the board, easy hire." },
            { userId: panelist2.id, score: 9, comments: "Best candidate we've seen for this role." },
            ...(mgmt ? [{ userId: mgmt.id, score: 9, comments: "Fully supportive of this hire." }] : []),
          ]
        : [
            { userId: interviewer.id, score: 8, comments: "Strong performance, clear strengths." },
            { userId: panelist2.id, score: 8, comments: "Impressive, keen to see them progress." },
          ];
    await ensureInterviewAt(hApp.id, stages[i]!.id, atTime(pastDay, 8 + i, 0), panel);
  }

  // 7. Already rejected -- rejected after round 1, so gets that one round's
  // real feedback (mixed/below-bar scores that justify the outcome) instead
  // of none at all.
  const rName = nextCandidateName();
  const rCand = await ensureCandidate(rName);
  const rApp = await ensureApplication(rCand.id, vac.id, hm.id, "REJECTED", stages[0]!.id, 10, {
    hiringDecision: "REJECT",
    decidedByUserId: hm.id,
    decidedAt: new Date(Date.now() - 4 * DAY_MS),
  });
  await ensureInterviewAt(rApp.id, stages[0]!.id, atTime(pastDay, 13, 0), [
    { userId: interviewer.id, score: 4, comments: "Struggled with core questions, several gaps." },
    { userId: panelist2.id, score: 5, comments: "Below the bar for this role, wouldn't advance." },
  ]);

  // 8. Comparison boost: extra scored round-1 candidates for the Candidate
  // Comparison page's ranking/distribution charts.
  if (spec.comparisonBoost) {
    const scores = [9, 8, 7, 6];
    for (let i = 0; i < scores.length; i++) {
      const score = scores[i]!;
      const name = nextCandidateName();
      const candidate = await ensureCandidate(name);
      const app = await ensureApplication(candidate.id, vac.id, hm.id, "SHORTLISTED", stages[0]!.id, 2);
      await ensureInterviewAt(app.id, stages[0]!.id, atTime(pastDay, 14 + i, 0), [
        { userId: panelist2.id, score, comments: score >= 8 ? "Excellent, a clear standout." : "Solid, some room to grow." },
      ]);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const hm = await mustGetUser("hiringmanager@altrium.com");
  const interviewer = await mustGetUser("interviewer@altrium.com");
  const mgmt = await mustGetUser("management@altrium.com"); // scoped to "IT" via prisma/seed.ts

  // Second panelist per department -- a single interviewer can't panel with
  // themselves, and Ian Foster (the real seeded login) is the constant across
  // every department so his own pages are populated everywhere.
  const naomi = await ensureUser("Naomi Reyes", "naomi.reyes@example.com", Role.INTERVIEWER, "Marketing");
  const owen = await ensureUser("Owen Brooks", "owen.brooks@example.com", Role.INTERVIEWER, "Legal");

  const SECOND_PANELIST: Record<string, { id: number }> = {
    HR: naomi,
    "Finance and Accounting": owen,
    Operations: naomi,
    Marketing: naomi,
    Sales: owen,
    IT: naomi,
    "Customer Service": owen,
    Legal: owen,
  };

  for (const spec of VACANCY_SPECS) {
    const vac = await ensureVacancy(spec.title, spec.dept, spec.description, spec.fillOffsetDays);
    const stages: Awaited<ReturnType<typeof ensureStage>>[] = [];
    for (let i = 0; i < spec.stages.length; i++) {
      stages.push(await ensureStage(vac.id, spec.stages[i]!, i + 1));
    }

    const panelist2 = SECOND_PANELIST[spec.dept]!;
    await ensurePoolMember(vac.id, interviewer.id);
    await ensurePoolMember(vac.id, panelist2.id);
    const mgmtForThisVacancy = spec.dept === "IT" ? mgmt : null;
    if (mgmtForThisVacancy) await ensurePoolMember(vac.id, mgmtForThisVacancy.id);

    await seedVacancyPipeline(vac, stages, hm, interviewer, panelist2, mgmtForThisVacancy, spec);
    console.log(`Seeded pipeline for "${spec.title}" (${spec.dept})`);
  }

  // A single busy interview day across several departments -- gives every
  // Interviews calendar (HR, Interviewer, Management, Hiring Manager) at
  // least one real day with multiple entries to click into.
  const busyDay = nextWeekday(4); // next Thursday
  const busySlots: { dept: string; title: string; hour: number; minute: number }[] = [
    { dept: "IT", title: "Backend Engineer", hour: 9, minute: 30 },
    { dept: "Marketing", title: "Content Marketing Specialist", hour: 11, minute: 0 },
    { dept: "Sales", title: "Account Executive", hour: 13, minute: 30 },
    { dept: "Operations", title: "Operations Manager", hour: 15, minute: 45 },
  ];
  for (const bs of busySlots) {
    const vac = await prisma.vacancy.findUnique({ where: { title_department: { title: bs.title, department: bs.dept } } });
    if (!vac) continue;
    const stage = await prisma.vacancyStage.findFirst({ where: { vacancyId: vac.id }, orderBy: { order: "asc" } });
    if (!stage) continue;
    const name = nextCandidateName();
    const candidate = await ensureCandidate(name);
    const app = await ensureApplication(candidate.id, vac.id, hm.id, "SHORTLISTED", stage.id, 1);
    await ensureInterviewAt(app.id, stage.id, atTime(busyDay, bs.hour, bs.minute), [
      { userId: interviewer.id, score: -1, comments: "" },
      { userId: SECOND_PANELIST[bs.dept]!.id, score: -1, comments: "" },
    ]);
  }

  // Audit Logs (IT Admin) -- one representative row per wired event type.
  // Seeding writes directly via Prisma, bypassing the controllers that
  // normally call writeAuditLog() as a side effect of a real action, so
  // without this the Audit Logs page would stay empty no matter how much
  // recruitment data exists everywhere else. Unlike everything above, these
  // inserts are NOT idempotent (no find-or-create check) -- rerunning this
  // script adds another copy of each row. Harmless (just a little repetitive
  // on the Audit Logs/notification bell if you run this more than once), not
  // worth guarding given these are cosmetic demo rows, not real data.
  const hr = await mustGetUser("hr@altrium.com");
  const itAdmin = await mustGetUser("itadmin@altrium.com");
  const auditEntries: { userId: number; action: string; entityType: string; daysAgo: number }[] = [
    { userId: hr.id, action: "VACANCY_CREATED", entityType: "Vacancy", daysAgo: 6 },
    { userId: hr.id, action: "VACANCY_EDITED", entityType: "Vacancy", daysAgo: 5 },
    { userId: hr.id, action: "VACANCY_CLOSED", entityType: "Vacancy", daysAgo: 1 },
    { userId: hr.id, action: "CV_UPLOADED", entityType: "Candidate", daysAgo: 4 },
    { userId: interviewer.id, action: "FEEDBACK_SUBMITTED", entityType: "Feedback", daysAgo: 3 },
    { userId: hr.id, action: "INTERVIEW_SCHEDULED", entityType: "Interview", daysAgo: 7 },
    { userId: hr.id, action: "NOTIFICATION_SENT", entityType: "Interview", daysAgo: 3 },
    { userId: itAdmin.id, action: "ACCOUNT_CREATED", entityType: "User", daysAgo: 30 },
    { userId: itAdmin.id, action: "ACCOUNT_DEACTIVATED", entityType: "User", daysAgo: 15 },
    { userId: itAdmin.id, action: "ROLE_CHANGED", entityType: "User", daysAgo: 20 },
  ];
  for (const entry of auditEntries) {
    await ensureAuditLog(entry.userId, entry.action, entry.entityType, null, entry.daysAgo);
  }

  // Notification inbox -- one unread + one read per real staff account, so
  // the bell icon has something to show for every role, not just an empty
  // dropdown.
  const leadership = await mustGetUser("leadership@altrium.com");
  const notifyTargets = [hr, interviewer, mgmt, hm, leadership, itAdmin];
  for (const target of notifyTargets) {
    await ensureNotification(target.id, "INTERVIEW_SCHEDULED", "A new interview has been scheduled on your calendar.", null, 2, false);
    await ensureNotification(target.id, "FEEDBACK_REMINDER", "You have feedback waiting to be submitted.", null, 6, true);
  }

  // Close a handful of vacancies -- Leadership's "Best Fill Rate" KPI is
  // literally closedVacancies/totalVacancies per department (see
  // leadership.controller.ts's buildDepartmentPerformanceData). Every
  // vacancy above is created OPEN, so without this every department would
  // sit at a meaningless, tied 0% and "Best Fill Rate" would just pick
  // whichever one happens to sort first. This gives real variation: Sales
  // both closed (100%), HR/Finance/Marketing/Customer Service one of two
  // (50%), Operations/IT/Legal left fully open (0%, still actively hiring).
  const closeVacancy = async (title: string, department: string) => {
    await prisma.vacancy.update({ where: { title_department: { title, department } }, data: { status: "CLOSED" } });
  };
  await closeVacancy("HR Business Partner", "HR");
  await closeVacancy("Senior Financial Analyst", "Finance and Accounting");
  await closeVacancy("Brand Manager", "Marketing");
  await closeVacancy("Account Executive", "Sales");
  await closeVacancy("Sales Development Representative", "Sales");
  await closeVacancy("Support Team Lead", "Customer Service");

  console.log("\nDone. Log in as any of the 7 seeded accounts (password123) to see real data on every page.");
  console.log(`Past interviews are dated ${pastDay.toDateString()}; the busy calendar day is ${busyDay.toDateString()}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
