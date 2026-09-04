// SUPERSEDED by scripts/seed-full-demo.ts (see project-decisions-log.md's
// "Seventeenth pass") -- that script now covers all 8 of these same
// departments with full pipelines, not just a couple of bare vacancies.
// Left in place, unused, for reference only.
//
// Populates a couple of open vacancies in each of the 8 departments shown on
// the HR Vacancies page's department grid (HR, Finance and Accounting,
// Operations, Marketing, Sales, IT, Customer Service, Legal). Before this,
// only Marketing/Sales/Customer Service had any vacancy at all (one each,
// created by the other seed scripts), so the other 5 department cards showed
// "No vacancies in this department yet." Safe to re-run -- every lookup is
// find-or-create.
//
// Note: these department names are a separate, HR-page-specific taxonomy
// from the freeform "Engineering"/"Data"/"Design"/"Support" department
// strings used elsewhere (Management/HM/Leadership screens). They don't need
// to match, and this script doesn't touch those.
//
// Run from the backend folder:
//   npx tsx scripts/seed-hr-department-vacancies.ts
import "dotenv/config";
import { prisma } from "../src/prisma.js";

const DAY_MS = 24 * 60 * 60 * 1000;

async function ensureVacancy(title: string, department: string, description: string, targetFillDateOffsetDays: number) {
  let vacancy = await prisma.vacancy.findUnique({ where: { title_department: { title, department } } });
  if (!vacancy) {
    vacancy = await prisma.vacancy.create({
      data: {
        title,
        department,
        description,
        status: "OPEN",
        targetFillDate: new Date(Date.now() + targetFillDateOffsetDays * DAY_MS),
      },
    });
    console.log(`Created vacancy "${vacancy.title}" (${department}, id ${vacancy.id})`);
  } else {
    console.log(`Reusing vacancy "${vacancy.title}" (${department}, id ${vacancy.id})`);
  }
  return vacancy;
}

async function ensureStage(vacancyId: number, name: string, order: number) {
  const existing = await prisma.vacancyStage.findUnique({ where: { vacancyId_order: { vacancyId, order } } });
  if (existing) return existing;
  return prisma.vacancyStage.create({ data: { vacancyId, name, order } });
}

const VACANCIES: { title: string; department: string; description: string; targetFillDateOffsetDays: number }[] = [
  {
    title: "HR Business Partner",
    department: "HR",
    description: "We're hiring an HR business partner to support managers across the org on hiring, performance, and employee relations.",
    targetFillDateOffsetDays: 30,
  },
  {
    title: "Talent Acquisition Coordinator",
    department: "HR",
    description: "We're hiring a talent acquisition coordinator to help schedule interviews and keep candidates informed throughout the process.",
    targetFillDateOffsetDays: 21,
  },
  {
    title: "Financial Analyst",
    department: "Finance and Accounting",
    description: "We're hiring a financial analyst to support budgeting, forecasting, and monthly reporting for the finance team.",
    targetFillDateOffsetDays: 35,
  },
  {
    title: "Accounts Payable Specialist",
    department: "Finance and Accounting",
    description: "We're hiring an accounts payable specialist to manage vendor invoices and payment processing.",
    targetFillDateOffsetDays: 25,
  },
  {
    title: "Operations Coordinator",
    department: "Operations",
    description: "We're hiring an operations coordinator to help streamline day-to-day processes across facilities and logistics.",
    targetFillDateOffsetDays: 28,
  },
  {
    title: "Supply Chain Analyst",
    department: "Operations",
    description: "We're hiring a supply chain analyst to optimize inventory planning and vendor coordination.",
    targetFillDateOffsetDays: 40,
  },
  {
    title: "Social Media Manager",
    department: "Marketing",
    description: "We're hiring a social media manager to grow our brand presence across social channels.",
    targetFillDateOffsetDays: 20,
  },
  {
    title: "Sales Development Representative",
    department: "Sales",
    description: "We're hiring a sales development representative to generate and qualify new pipeline for the sales team.",
    targetFillDateOffsetDays: 18,
  },
  {
    title: "IT Support Technician",
    department: "IT",
    description: "We're hiring an IT support technician to provide first-line support for hardware, software, and network issues.",
    targetFillDateOffsetDays: 15,
  },
  {
    title: "Systems Administrator",
    department: "IT",
    description: "We're hiring a systems administrator to manage internal servers, cloud accounts, and access provisioning.",
    targetFillDateOffsetDays: 32,
  },
  {
    title: "Customer Support Representative",
    department: "Customer Service",
    description: "We're hiring a customer support representative to help resolve customer issues over chat and email.",
    targetFillDateOffsetDays: 14,
  },
  {
    title: "Legal Counsel",
    department: "Legal",
    description: "We're hiring in-house legal counsel to support contract review and commercial negotiations.",
    targetFillDateOffsetDays: 45,
  },
  {
    title: "Compliance Analyst",
    department: "Legal",
    description: "We're hiring a compliance analyst to help maintain regulatory compliance across our markets.",
    targetFillDateOffsetDays: 30,
  },
];

async function main() {
  for (const v of VACANCIES) {
    const vacancy = await ensureVacancy(v.title, v.department, v.description, v.targetFillDateOffsetDays);
    await ensureStage(vacancy.id, "Screening Interview", 1);
    await ensureStage(vacancy.id, "Final Interview", 2);
  }

  console.log("\nDone. Open the HR Vacancies page -- every department card now has open vacancies.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
