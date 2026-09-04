// One-off helper: creates a single staff user with a real name, a bcrypt
// password hash (same 10 salt rounds as prisma/seed.ts), and an optional
// department -- for populating pickers like the Assign Interview Panel
// modal with proper names instead of leftover regression test data.
//
// Run from the backend folder:
//   npx tsx scripts/add-staff.ts "Ivy Alvarez" "ivy.alvarez@altrium.com" INTERVIEWER "Engineering"
//   npx tsx scripts/add-staff.ts "Noah Bennett" "noah.bennett@altrium.com" HIRING_MANAGER
//
// Role must be one of: HR, INTERVIEWER, MANAGEMENT, HIRING_MANAGER, IT_ADMIN, LEADERSHIP_MANAGEMENT
// Department is optional -- omit it for none.
// Password defaults to "password123" (same convention as the seeded test accounts) if not given.
import "dotenv/config";
import bcrypt from "bcrypt";
import { Role } from "../generated/prisma/index.js";
import { prisma } from "../src/prisma.js";

async function main() {
  const [name, email, roleArg, department, password = "password123"] = process.argv.slice(2);

  if (!name || !email || !roleArg || !(roleArg in Role)) {
    console.error(
      'Usage: npx tsx scripts/add-staff.ts "<name>" "<email>" <ROLE> ["<department>"] ["<password>"]'
    );
    console.error(`Role must be one of: ${Object.keys(Role).join(", ")}`);
    process.exitCode = 1;
    return;
  }
  const role = roleArg as Role;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`A user with email "${email}" already exists (id ${existing.id}, role ${existing.role}). Nothing created.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role, department: department || null, isActive: true },
  });

  console.log(`Created ${role} "${user.name}" <${user.email}> (id ${user.id}), password: ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
