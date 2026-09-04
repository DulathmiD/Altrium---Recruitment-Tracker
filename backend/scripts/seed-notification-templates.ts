// SCRUM2-45: seeds NotificationTemplate with the exact default text every
// automatic send already used before this feature existed (see
// src/utils/notificationTemplates.ts). Safe to re-run -- upsert on the
// unique `key`, so it never duplicates rows; re-running it after IT Admin
// has already edited a template will NOT overwrite their edit (only creates
// rows that don't exist yet -- see the `skipDuplicates`-equivalent check
// below).
//
// Not required before the app works: renderTemplate() already falls back to
// the hardcoded defaults when no row exists. Running this just gives IT
// Admin's Notification Templates screen a starting row to edit instead of an
// empty "not customized yet" state for every template.
//
// Run from the backend folder:
//   npx tsx scripts/seed-notification-templates.ts
import "dotenv/config";
import { prisma } from "../src/prisma.js";
import { TEMPLATE_KEYS, DEFAULT_TEMPLATES } from "../src/utils/notificationTemplates.js";

async function main() {
  let createdCount = 0;
  let skippedCount = 0;

  for (const key of TEMPLATE_KEYS) {
    const existing = await prisma.notificationTemplate.findUnique({ where: { key } });
    if (existing) {
      skippedCount++;
      continue;
    }
    await prisma.notificationTemplate.create({
      data: { key, subject: DEFAULT_TEMPLATES[key].subject, body: DEFAULT_TEMPLATES[key].body },
    });
    createdCount++;
  }

  console.log(`Notification templates: ${createdCount} created, ${skippedCount} already existed (left untouched).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
