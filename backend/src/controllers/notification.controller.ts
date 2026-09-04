// SCRUM2-31: in-app notification inbox -- read/mark-read endpoints. Writes
// happen at each staff-facing send site via utils/notify.ts, not here.
import type { Request, Response } from "express";
import { prisma } from "../prisma.js";

export async function listMyNotifications(req: Request, res: Response) {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch notifications" });
  }
}

export async function getUnreadCount(req: Request, res: Response) {
  try {
    const count = await prisma.notification.count({ where: { userId: req.user!.id, read: false } });
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch unread count" });
  }
}

export async function markNotificationRead(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid notification id" });
  }

  try {
    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user!.id) {
      // Same not-found response whether it doesn't exist or belongs to
      // someone else -- never confirm another user's notification id exists.
      return res.status(404).json({ error: "Notification not found" });
    }

    const notification = await prisma.notification.update({ where: { id }, data: { read: true } });
    res.json(notification);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update notification" });
  }
}

export async function markAllNotificationsRead(req: Request, res: Response) {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true },
    });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update notifications" });
  }
}
