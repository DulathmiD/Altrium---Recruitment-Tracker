import { Router } from "express";
import {
  listNotificationTemplates,
  updateNotificationTemplate,
  resetNotificationTemplate,
} from "../controllers/notificationTemplate.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import { Role } from "../../generated/prisma/index.js";

export const notificationTemplateRouter = Router();

notificationTemplateRouter.use(requireAuth);

notificationTemplateRouter.get("/", requireRole(Role.IT_ADMIN), listNotificationTemplates);
notificationTemplateRouter.patch("/:key", requireRole(Role.IT_ADMIN), updateNotificationTemplate);
notificationTemplateRouter.post("/:key/reset", requireRole(Role.IT_ADMIN), resetNotificationTemplate);
