import bcrypt from "bcrypt";
import { Role } from "../generated/prisma/index.js";
import { prisma } from "../src/prisma.js";

const testUsers = [
  { name: "Hannah HR", email: "hr@altrium.test", password: "password123", role: Role.HR, department: null },
  { name: "Ian Interviewer", email: "interviewer@altrium.test", password: "password123", role: Role.INTERVIEWER, department: "Engineering" },
  { name: "Mary Management", email: "management@altrium.test", password: "password123", role: Role.MANAGEMENT, department: "Engineering" },
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
      },
    });

    console.log(`  ${u.role.padEnd(12)} ${u.email.padEnd(28)} password: ${u.password}`);
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
