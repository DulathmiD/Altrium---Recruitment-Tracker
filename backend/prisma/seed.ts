import "dotenv/config";
import bcrypt from "bcrypt";
import { Role } from "../generated/prisma/index.js";
import { prisma } from "../src/prisma.js";

// Viva reset: previous roster used role-labelled emails (hr@altrium.com,
// interviewer@altrium.com, ...) and a single shared password ("password123")
// across every account. Two problems with that, both raised directly before
// this rewrite: (1) role-in-email reads as an obvious test fixture rather
// than a real person, worth avoiding for a live demo audience; (2)
// "password123" is one of the most common passwords in public breach
// corpora, so Chrome/Google's account-security check flags it on every
// login -- distracting mid-viva even though nothing is actually
// compromised. Fixed by giving every account a real first+last name (no
// role word anywhere in the email) and a distinct, non-breached password
// per person (Firstname@2026 -- easy to read out live, not on any breach
// list). Department assignments are unchanged from the previous roster
// (still needed for Management/Leadership dashboard scoping -- see
// seed-viva-demo.ts).
const testUsers = [
  // Department cosmetic per user's explicit choice: HR/IT Admin/Leadership
  // don't actually use req.user.department anywhere in the backend (checked
  // before this pass -- none of their controllers filter by it, unlike
  // Interviewer/Management/Hiring Manager, which genuinely are department-
  // scoped). These three values are display-only on IT Admin's Users table.
  { name: "Sharon Whitfield", email: "sharon@altrium.com", password: "Sharon@2026", role: Role.HR, department: "HR", isActive: true },
  { name: "Marcus Feldman", email: "marcus@altrium.com", password: "Marcus@2026", role: Role.INTERVIEWER, department: "IT", isActive: true },
  { name: "Elena Torres", email: "elena@altrium.com", password: "Elena@2026", role: Role.MANAGEMENT, department: "IT", isActive: true },
  { name: "Victor Adeyemi", email: "victor@altrium.com", password: "Victor@2026", role: Role.HIRING_MANAGER, department: "IT", isActive: true },
  { name: "Naomi Clarke", email: "naomi@altrium.com", password: "Naomi@2026", role: Role.IT_ADMIN, department: "IT", isActive: true },
  { name: "Daniel Osei", email: "daniel@altrium.com", password: "Daniel@2026", role: Role.LEADERSHIP_MANAGEMENT, department: "Leadership", isActive: true },
  // One Management account per department, added because Management's own
  // Reports/Dashboard pages hard-scope by a single User.department string
  // (management.controller.ts's getReportPdf/getManagementDashboard both
  // read req.user!.department directly) -- Elena alone couldn't legitimately
  // cover all 8 departments' final rounds AND have her own Reports page mean
  // anything. Real names, no role word in the email, same Firstname@2026
  // pattern as everyone else. Each is wired to their own department's
  // vacancy/final-round panels only in seed-viva-demo.ts.
  { name: "Bianca Whitmore", email: "bianca@altrium.com", password: "Bianca@2026", role: Role.MANAGEMENT, department: "Marketing", isActive: true },
  { name: "Derek Holloway", email: "derek@altrium.com", password: "Derek@2026", role: Role.MANAGEMENT, department: "Sales", isActive: true },
  { name: "Fatima Rasheed", email: "fatima@altrium.com", password: "Fatima@2026", role: Role.MANAGEMENT, department: "Customer Service", isActive: true },
  { name: "Callum Ferris", email: "callum@altrium.com", password: "Callum@2026", role: Role.MANAGEMENT, department: "HR", isActive: true },
  { name: "Nadia Petrov", email: "nadia@altrium.com", password: "Nadia@2026", role: Role.MANAGEMENT, department: "Finance and Accounting", isActive: true },
  { name: "Owen Sinclair", email: "owen@altrium.com", password: "Owen@2026", role: Role.MANAGEMENT, department: "Operations", isActive: true },
  { name: "Miriam Cole", email: "miriam@altrium.com", password: "Miriam@2026", role: Role.MANAGEMENT, department: "Legal", isActive: true },
  // Kept inactive on purpose -- this is the one account that demonstrates
  // IT Admin's Deactivate/Activate control and the "Inactive" status pill.
  { name: "Rachel Kim", email: "rachel@altrium.com", password: "Rachel@2026", role: Role.HR, department: "Talent Acquisition", isActive: false },
  // Real-inbox account, kept from the previous roster -- every other login
  // above uses @altrium.com, a domain with no real mailbox behind it, so
  // Forgot Password can never show a real received email for any of them.
  // This one has an actual checkable inbox, specifically so there's always
  // one login where triggering a password reset live actually produces an
  // email someone can open and show. Role is INTERVIEWER (changed from HR)
  // so this account is also a valid interview panelist -- ASSIGNABLE_ROLES
  // only permits Interviewer/Management/Hiring Manager -- and seed-viva-
  // demo.ts adds it as an extra panelist on specific interviews so certain
  // Follow Ups sends land in this real inbox during the viva.
  { name: "Jordan Blake", email: "dulzxitzy@gmail.com", password: "Jordan@2026", role: Role.INTERVIEWER, department: "IT", isActive: true },
];

async function main() {
  console.log("\nSeeded accounts:\n");

  for (const u of testUsers) {
    const passwordHash = await bcrypt.hash(u.password, 10);

    // Deliberately does NOT touch passwordHash on update -- a rerun after
    // this script has already created the account should never silently
    // reset a password someone changed via the real change/reset flow since.
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

    console.log(`  ${u.role.padEnd(22)} ${u.email.padEnd(24)} active: ${u.isActive}  password: ${u.password}`);
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
