import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    globalSetup: "tests/global-setup.ts",
    include: ["tests/**/*.test.ts"],
    testTimeout: 15000,
  },
});
