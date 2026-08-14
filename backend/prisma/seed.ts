import "dotenv/config";
import bcrypt from "bcrypt";
import { Role } from "../generated/prisma/index.js";
import { prisma } from "../src/prisma.js";

const testUsers = [
  { name: "Hannah HR", email: "hr@altrium.test", password: "password123", role: Role.HR, department: null, isActive: true },
  { name: "Ian Interviewer", email: "interviewer@altrium.test", password: "password123", role: Role.INTERVIEWER, department: "Engineering", isActive: true },
  { name: "Mary Management", email: "management@altrium.test", password: "password123", role: Role.MANAGEMENT, department: "Engineering", isActive: true },
  { name: "Harry Hiring Manager", email: "hiringmanager@altrium.test", password: "password123", role: Role.HIRING_MANAGER, department: "Engineering", isActive: true },
  { name: "Isla IT Admin", email: "itadmin@altrium.test", password: "password123", role: Role.IT_ADMIN, department: null, isActive: true },
  { name: "Leo Leadership", email: "leadership@altrium.test", password: "password123", role: Role.LEADERSHIP_MANAGEMENT, department: null, isActive: true },
  { name: "Disabled Test User", email: "disabled@altrium.test", password: "password123", role: Role.HR, department: "Talent Acquisition", isActive: false },
];

async function main() {
  console.log("\nSeeded test accounts:\n");

  for (const u of testUsers) {
    const passwordHash = await bcrypt.hash(u.password, 10);

    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
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