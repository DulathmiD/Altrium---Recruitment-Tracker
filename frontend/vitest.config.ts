// Deliberately has zero imports (not even from "vitest/config" or "vite").
// Vitest normally auto-merges the project's vite.config.ts, but that file
// imports "vite" and "@vitejs/plugin-react" for the app's dev/build setup --
// dependencies this test config has no reason to need. Keeping this as a
// plain object avoids pulling those in just to run unit tests.
export default {
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
};
