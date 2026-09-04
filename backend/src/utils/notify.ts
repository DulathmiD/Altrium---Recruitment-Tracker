// SCRUM2-31: in-app notification inbox.
//
// Single choke point for writing a Notification row, same reasoning as
// writeAuditLog() -- called alongside sendEmail() at every STAFF-facing send
// site (candidates aren't app users and never log in, so they have no inbox
// to write to; candidate-facing emails -- interview invite, hire/reject --
// only get the email, not a Notification row).
import { prisma } from "../prisma.js";

export async function notifyUser(userId: number, type: string, message: string, link?: string): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, type, message, ...(link !== undefined ? { link } : {}) },
    });
  } catch (err) {
    // Same contract as sendEmail() call sites: a notification failing to
    // write must never block the underlying action (interview scheduled,
    // reminder sent, etc.) that triggered it.
    console.error(`Could not write in-app notification for user ${userId}:`, err);
  }
}
