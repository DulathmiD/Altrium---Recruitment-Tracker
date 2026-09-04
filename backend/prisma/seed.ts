import "dotenv/config";
import bcrypt from "bcrypt";
import { Role } from "../generated/prisma/index.js";
import { prisma } from "../src/prisma.js";

// Department reset pass: these three used to say "Engineering", which was
// never one of HR's own 8 canonical departments (HR, Finance and Accounting,
// Operations, Marketing, Sales, IT, Customer Service, Legal -- see
// seed-hr-department-vacancies.ts) -- a separate, unrelated freeform taxonomy
// that never lined up with anything HR's own Vacancies page showed. Moved
// onto "IT" so Management's single-department Dashboard actually has real
// vacancies to scope to (see seed-full-demo.ts, which seeds Backend Engineer/
// IT Support Specialist under "IT"). Doesn't functionally matter for
// Interviewer/Hiring Manager (their pages scope by panelist/hiringManagerId
// assignment, not this field) but kept consistent for the Users list.
const testUsers = [
  { name: "Hannah HR", email: "hr@altrium.com", password: "password123", role: Role.HR, department: null, isActive: true },
  { name: "Ian Foster", email: "interviewer@altrium.com", password: "password123", role: Role.INTERVIEWER, department: "IT", isActive: true },
  { name: "Mary Management", email: "management@altrium.com", password: "password123", role: Role.MANAGEMENT, department: "IT", isActive: true },
  { name: "Harry Dawson", email: "hiringmanager@altrium.com", password: "password123", role: Role.HIRING_MANAGER, department: "IT", isActive: true },
  { name: "Isla IT Admin", email: "itadmin@altrium.com", password: "password123", role: Role.IT_ADMIN, department: null, isActive: true },
  { name: "Leo Leadership", email: "leadership@altrium.com", password: "password123", role: Role.LEADERSHIP_MANAGEMENT, department: null, isActive: true },
  { name: "Priya Fernando", email: "disabled@altrium.com", password: "password123", role: Role.HR, department: "Talent Acquisition", isActive: false },
];

async function main() {
  console.log("\nSeeded accounts:\n");

  for (const u of testUsers) {
    const passwordHash = await bcrypt.hash(u.password, 10);

    // Bug fix: `update: {}` meant this upsert never actually updated an
    // already-existing account -- rerunning this script after changing a
    // department above (or anything else here) silently did nothing for
    // accounts created before the change. Now syncs name/department/isActive
    // on every rerun. Deliberately does NOT touch passwordHash on update --
    // don't want a rerun to silently reset a password someone changed via
    // the real reset-password flow since this script was last run.
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        department: u.department,
        isActive: u.isActive,
      },
      create: {
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        department: u.department,
        isActive: u.isActive,
      },
    });

    console.log(`  ${u.role.padEnd(22)} ${u.email.padEnd(28)} active: ${u.isActive}  password: ${u.password}`);
  }

  console.log("");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });