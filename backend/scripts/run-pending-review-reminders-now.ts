// Manual test trigger for the new pending-review/overdue-feedback reminder
// job (see src/jobs/pendingReviewReminders.ts) -- that job is scheduled to
// run once a day at 08:00, which isn't practical to sit and wait for while
// testing or demoing. This runs the exact same check function directly, on
// demand.
//
// Run from the backend folder:
//   npx tsx scripts/run-pending-review-reminders-now.ts
import "dotenv/config";
import { runPendingReviewReminderCheck } from "../src/jobs/pendingReviewReminders.js";
import { prisma } from "../src/prisma.js";

runPendingReviewReminderCheck()
  .then(() => {
    console.log("Pending review reminder check complete.");
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
