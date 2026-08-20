import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.routes.js";
import { vacancyRouter } from "./routes/vacancy.routes.js";
import { candidateRouter } from "./routes/candidate.routes.js";
import { applicationRouter } from "./routes/application.routes.js";
import { interviewRouter } from "./routes/interview.routes.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/vacancies", vacancyRouter);
app.use("/api/candidates", candidateRouter);
app.use("/api/applications", applicationRouter);
app.use("/api/interviews", interviewRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
