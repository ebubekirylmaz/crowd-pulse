import { defineConfig } from "vitest/config";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const envFile = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const baseUrl = process.env.DATABASE_URL ?? "";
process.env.ADMIN_DATABASE_URL = baseUrl.replace(/\/[^/]*$/, "/postgres");
process.env.DATABASE_URL = baseUrl.replace(/\/[^/]*$/, "/crowd_pulse_test");
process.env.NODE_ENV = "test";
process.env.DEMO_LIMIT_PER_HOUR = "1000";

export default defineConfig({
  test: {
    globalSetup: ["./test/globalSetup.ts"],
    fileParallelism: false,
    testTimeout: 15000,
  },
});
