import { apiFetch } from "./client";

// SCRUM2-31. Every role has its own inbox, scoped server-side to req.user.id.
export type Notification = {
  id: number;
  type: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export function listMyNotifications() {
  return apiFetch<Notification[]>("/notifications");
}

export function getUnreadNotificationCount() {
  return apiFetch<{ count: number }>("/notifications/unread-count");
}

export function markNotificationRead(id: number) {
  return apiFetch<Notification>(`/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllNotificationsRead() {
  return apiFetch<void>("/notifications/read-all", { method: "PATCH" });
}
