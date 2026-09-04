import "./pdfEnvPolyfills.js";
import "dotenv/config";
import { app } from "./app.js";
import { startInterviewReminderJob } from "./jobs/interviewReminders.js";

const PORT = process.env["PORT"] ?? 4000;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

// Started here rather than in app.ts deliberately -- app.ts is imported
// directly by the Vitest+supertest test suite, which must not have a
// background cron job ticking during a test run.
startInterviewReminderJob();
