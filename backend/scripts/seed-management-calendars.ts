// One-off fix: every department Management account's "My Interviews" calendar
// was empty (no red-highlighted dates). Root cause, found by reading the
// actual query: getUpcomingInterviews (management.controller.ts) only shows
// interviews where slot.scheduledAt >= now -- and seed-viva-demo.ts's only
// Management-attended interview (Marketing's Baptiste, final round) was
// deliberately dated 2 days in the PAST (Date.now() - 2*DAY_MS) for a
// different purpose (Email History / past-interview demo content) -- so it
// already correctly does NOT show as "upcoming". Every other department
// (Sales, Customer Service, HR, Finance, Operations, Legal, and Elena's IT)
// only got their Management account added to the vacancy's interviewer POOL
// (ensurePoolMember) -- no interview was ever actually scheduled with them,
// so there was nothing for the calendar to show even if the date had been
// right.
//
// This script does NOT touch seed-viva-demo.ts or re-run it. For each of the
// 8 Management accounts it finds the vacancy they're already pooled on,
// takes that vacancy's final round (highest VacancyStage.order), picks one
// SHORTLISTED candidate already applied to it, and ensures a real
// InterviewSlot + Interview exists there dated a few business days in the
// future (spread one weekday apart, 9am-5pm per the app's time picker
// bound), with the department's own Management account as a panelist --
// matching the enforced "Management must attend the final round" rule.
// Idempotent: if an interview already exists for that application+round, it
// only nudges the date forward if it's stale (already in the past) and adds
// the Management user as a panelist if they're somehow missing, rather than
// creating a duplicate.
//
// Run from the backend folder:
//   npx tsx scripts/seed-management-calendars.ts
import "dotenv/config";
import { prisma } from "../src/prisma.js";

const DEPARTMENTS: { email: string; department: string }[] = [
  { email: "elena@altrium.com", department: "IT" },
  { email: "bianca@altrium.com", department: "Marketing" },
  { email: "derek@altrium.com", department: "Sales" },
  { email: "fatima@altrium.com", department: "Customer Service" },
  { email: "callum@altrium.com", department: "HR" },
  { email: "nadia@altrium.com", department: "Finance and Accounting" },
  { email: "owen@altrium.com", department: "Operations" },
  { email: "miriam@altrium.com", department: "Legal" },
];

// Next weekday that's `businessDaysAhead` weekdays from today (skips
// Sat/Sun so nothing lands on a day HR's 9am-5pm time picker would never
// actually offer), fixed to a specific hour so it's unambiguously "upcoming"
// and inside the app's allowed interview-time window.
function nextBusinessDay(businessDaysAhead: number, hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  let remaining = businessDaysAhead;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay(); // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6) remaining--;
  }
  return d;
}

async function main() {
  const HOURS = [10, 11, 13, 14, 15]; // stays inside the 9am-5pm bound with a lunch gap

  for (let i = 0; i < DEPARTMENTS.length; i++) {
    const { email, department } = DEPARTMENTS[i]!;
    const mgmt = await prisma.user.findUnique({ where: { email } });
    if (!mgmt) {
      console.log(`Skipped ${department}: no user found for ${email} -- run "npx prisma db seed" first.`);
      continue;
    }

    // The vacancy this Management account is already pooled on (every
    // department's seed data adds this via ensurePoolMember).
    const pool = await prisma.vacancyInterviewer.findFirst({
      where: { userId: mgmt.id },
      include: { vacancy: { include: { stages: { orderBy: { order: "desc" } } } } },
    });
    if (!pool || pool.vacancy.stages.length === 0) {
      console.log(`Skipped ${department} (${mgmt.name}): not pooled on any vacancy with interview rounds set up yet.`);
      continue;
    }

    const vacancy = pool.vacancy;
    const finalStage = vacancy.stages[0]!; // stages sorted order desc, so [0] is the highest (final) round

    const application = await prisma.candidateApplication.findFirst({
      where: { vacancyId: vacancy.id, stage: "SHORTLISTED" },
      include: { candidate: true },
    });
    if (!application) {
      console.log(`Skipped ${department} (${mgmt.name}): no SHORTLISTED candidate on "${vacancy.title}" to schedule into the final round.`);
      continue;
    }

    const scheduledAt = nextBusinessDay(i + 1, HOURS[i % HOURS.length]!);

    const existing = await prisma.interview.findFirst({
      where: { applicationId: application.id, slot: { vacancyStageId: finalStage.id } },
      include: { slot: { include: { panelists: true } } },
    });

    if (existing) {
      const needsReschedule = existing.slot.scheduledAt < new Date();
      const alreadyPanelist = existing.slot.panelists.some((p) => p.userId === mgmt.id);
      if (needsReschedule) {
        await prisma.interviewSlot.update({ where: { id: existing.slot.id }, data: { scheduledAt } });
        console.log(`${department}: rescheduled existing final-round interview for ${application.candidate.name} to ${scheduledAt.toLocaleString()}.`);
      }
      if (!alreadyPanelist) {
        await prisma.interviewPanelist.create({ data: { slotId: existing.slot.id, userId: mgmt.id } });
        console.log(`${department}: added ${mgmt.name} as a panelist on the existing final-round interview.`);
      }
      if (!needsReschedule && alreadyPanelist) {
        console.log(`${department}: already has an upcoming final-round interview with ${mgmt.name} on it -- nothing to do.`);
      }
      continue;
    }

    const slot = await prisma.interviewSlot.create({
      data: { vacancyStageId: finalStage.id, scheduledAt, panelists: { create: [{ userId: mgmt.id }] } },
    });
    await prisma.interview.create({ data: { slotId: slot.id, applicationId: application.id } });
    console.log(`${department}: scheduled ${application.candidate.name}'s final round ("${finalStage.name}") for ${scheduledAt.toLocaleString()} with ${mgmt.name} on the panel.`);
  }

  console.log("\nDone. Log into each Management account and check My Interviews.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
