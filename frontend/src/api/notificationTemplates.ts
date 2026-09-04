import { apiFetch } from "./client";

// SCRUM2-45. Keys are a fixed, backend-defined set -- see
// backend/src/utils/notificationTemplates.ts. No create/delete here, only
// read + update (+ reset back to default).
export type NotificationTemplate = {
  key: string;
  label: string;
  placeholders: string[];
  subject: string;
  body: string;
  updatedAt: string | null;
  isDefault: boolean;
};

export function listNotificationTemplates() {
  return apiFetch<NotificationTemplate[]>("/notification-templates");
}

export function updateNotificationTemplate(key: string, subject: string, body: string) {
  return apiFetch<{ key: string; subject: string; body: string; updatedAt: string }>(
    `/notification-templates/${key}`,
    { method: "PATCH", body: JSON.stringify({ subject, body }) }
  );
}

export function resetNotificationTemplate(key: string) {
  return apiFetch<{ key: string; subject: string; body: string; isDefault: boolean }>(
    `/notification-templates/${key}/reset`,
    { method: "POST" }
  );
}
