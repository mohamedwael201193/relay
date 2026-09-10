import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "frontend/src/lib/relay/**/*.test.ts"],
  },
});
