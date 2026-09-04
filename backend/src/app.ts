import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.routes.js";
import { vacancyRouter } from "./routes/vacancy.routes.js";
import { candidateRouter } from "./routes/candidate.routes.js";
import { applicationRouter } from "./routes/application.routes.js";
import { interviewRouter } from "./routes/interview.routes.js";
import { feedbackRouter } from "./routes/feedback.routes.js";
import { reportsRouter } from "./routes/reports.routes.js";
import { auditLogRouter } from "./routes/auditLog.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { staffRouter } from "./routes/staff.routes.js";
import { followUpRouter } from "./routes/followUp.routes.js";
import { hiringManagerRouter } from "./routes/hiringManager.routes.js";
import { managementRouter } from "./routes/management.routes.js";
import { interviewerRouter } from "./routes/interviewer.routes.js";
import { leadershipRouter } from "./routes/leadership.routes.js";
import { systemRouter } from "./routes/system.routes.js";
import { notificationRouter } from "./routes/notification.routes.js";
import { notificationTemplateRouter } from "./routes/notificationTemplate.routes.js";
import { requestTimingMiddleware } from "./utils/systemMetrics.js";

export const app = express();

app.use(cors());
app.use(express.json());
app.use(requestTimingMiddleware);

app.use("/api/auth", authRouter);
app.use("/api/vacancies", vacancyRouter);
app.use("/api/candidates", candidateRouter);
app.use("/api/applications", applicationRouter);
app.use("/api/interviews", interviewRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/audit-logs", auditLogRouter);
app.use("/api/users", userRouter);
app.use("/api/staff", staffRouter);
app.use("/api/follow-ups", followUpRouter);
app.use("/api/hiring-manager", hiringManagerRouter);
app.use("/api/management", managementRouter);
app.use("/api/interviewer", interviewerRouter);
app.use("/api/leadership", leadershipRouter);
app.use("/api/system", systemRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/notification-templates", notificationTemplateRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// In production we serve the built frontend (frontend/dist) from this same
// Express server, so the app's relative `/api/...` fetches
// (frontend/src/api/*.ts) resolve correctly with no CORS/proxy setup needed --
// browser and API are on the same origin. Locally, frontend/dist normally
// doesn't exist (the frontend runs via `npm run dev` + the Vite proxy
// instead), so this block is a safe no-op in development.
const frontendDist = path.join(fileURLToPath(new URL(".", import.meta.url)), "../../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// Global error handler -- last line of defense. Every controller in this
// app already catches its own DB/business-logic errors and returns a proper
// JSON error response (auth.controller.ts was the one gap, fixed separately
// -- see decision log's "login crash bug fix" entry), so in normal operation
// this should never fire. It exists so that if a *future* route handler ever
// throws without its own try/catch, the client still gets a clean JSON 500
// instead of a dropped connection with no body -- which is exactly the
// failure mode that produced the "Failed to execute 'json' on 'Response'"
// crash on the login screen. Must be registered after every other
// app.use/route, and must keep all 4 parameters (err, req, res, next) --
// Express only treats a middleware function as an error handler when it has
// exactly 4 declared parameters, so removing any of them (even a placeholder
// `_req`) silently turns this into a normal (non-error) middleware.
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});
