import { defineConfig } from "vitest/config";

// Unit/logic tests only -- no real database. Every test that touches a
// controller mocks "../prisma.js" so the real Prisma client (which needs a
// live DATABASE_URL connection, per src/prisma.ts) never actually loads.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
