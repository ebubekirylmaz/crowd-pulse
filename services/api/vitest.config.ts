import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));

const baseUrl = process.env.DATABASE_URL ?? "";
process.env.ADMIN_DATABASE_URL = baseUrl.replace(/\/[^/]*$/, "/postgres");
process.env.DATABASE_URL = baseUrl.replace(/\/[^/]*$/, "/crowd_pulse_test");
process.env.NODE_ENV = "test";

export default defineConfig({
  test: {
    globalSetup: ["./test/globalSetup.ts"],
    fileParallelism: false,
    testTimeout: 15000,
  },
});
