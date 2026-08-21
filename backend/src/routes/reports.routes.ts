import { Router } from "express";
import { getDashboard, getStageMonitoring, getKpis } from "../controllers/reports.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

reportsRouter.get("/dashboard", getDashboard);
reportsRouter.get("/stage-monitoring", getStageMonitoring);
reportsRouter.get("/kpis", getKpis);
