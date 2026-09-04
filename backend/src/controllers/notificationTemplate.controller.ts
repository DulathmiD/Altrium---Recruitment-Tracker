// SCRUM2-45: IT Admin CRUD (read + update only, see schema.prisma comment on
// NotificationTemplate for why keys are fixed rather than freely creatable).
import type { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { writeAuditLog } from "../utils/auditLog.js";
import { TEMPLATE_KEYS, TEMPLATE_META, DEFAULT_TEMPLATES, type TemplateKey } from "../utils/notificationTemplates.js";

function isTemplateKey(key: string): key is TemplateKey {
  return (TEMPLATE_KEYS as readonly string[]).includes(key);
}

// Lists all fixed keys, each merged with its DB row if one exists yet, or
// the hardcoded default otherwise -- so the editor screen always shows every
// template, even ones nobody has touched since the seed script ran.
export async function listNotificationTemplates(_req: Request, res: Response) {
  try {
    const rows = await prisma.notificationTemplate.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r]));

    const templates = TEMPLATE_KEYS.map((key) => {
      const row = byKey.get(key);
      return {
        key,
        label: TEMPLATE_META[key].label,
        placeholders: TEMPLATE_META[key].placeholders,
        subject: row?.subject ?? DEFAULT_TEMPLATES[key].subject,
        body: row?.body ?? DEFAULT_TEMPLATES[key].body,
        updatedAt: row?.updatedAt ?? null,
        isDefault: !row,
      };
    });

    res.json(templates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch notification templates" });
  }
}

export async function updateNotificationTemplate(req: Request, res: Response) {
  const { key } = req.params as { key: string };
  if (!isTemplateKey(key)) {
    return res.status(404).json({ error: "Unknown template key" });
  }

  const { subject, body } = req.body as { subject?: string; body?: string };
  if (!subject || !subject.trim() || !body || !body.trim()) {
    return res.status(400).json({ error: "subject and body are required" });
  }

  try {
    const template = await prisma.notificationTemplate.upsert({
      where: { key },
      create: { key, subject: subject.trim(), body: body.trim(), updatedByUserId: req.user!.id },
      update: { subject: subject.trim(), body: body.trim(), updatedByUserId: req.user!.id },
    });

    await writeAuditLog(req.user!.id, "NOTIFICATION_TEMPLATE_UPDATED", "NotificationTemplate", template.id, {
      key,
    });

    res.json(template);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update notification template" });
  }
}

// Resets a template back to its hardcoded default by deleting the DB
// override row -- renderTemplate() already falls back to DEFAULT_TEMPLATES
// when no row exists, so this is a real "reset," not just a re-copy.
export async function resetNotificationTemplate(req: Request, res: Response) {
  const { key } = req.params as { key: string };
  if (!isTemplateKey(key)) {
    return res.status(404).json({ error: "Unknown template key" });
  }

  try {
    await prisma.notificationTemplate.deleteMany({ where: { key } });
    await writeAuditLog(req.user!.id, "NOTIFICATION_TEMPLATE_UPDATED", "NotificationTemplate", null, {
      key,
      reset: true,
    });
    res.json({ key, subject: DEFAULT_TEMPLATES[key].subject, body: DEFAULT_TEMPLATES[key].body, isDefault: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not reset notification template" });
  }
}
