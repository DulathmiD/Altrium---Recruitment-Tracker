import { Router } from "express";
import {
  listMyNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notification.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

// No role gate -- every role has its own inbox, scoped to req.user.id inside
// the controller. Same pattern as any "my own stuff" endpoint elsewhere.
notificationRouter.get("/", listMyNotifications);
notificationRouter.get("/unread-count", getUnreadCount);
notificationRouter.patch("/:id/read", markNotificationRead);
notificationRouter.patch("/read-all", markAllNotificationsRead);
