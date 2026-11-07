import { defineConfig } from "@playwright/test";

const api = "http://localhost:3100";
const shell = "http://localhost:4175";
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: ci ? 1 : 0,
  reporter: ci ? [["github"], ["list"]] : "list",
  use: {
    baseURL: shell,
    trace: "retain-on-failure",
    channel: process.env.E2E_CHANNEL || undefined,
  },
  webServer: [
    {
      command: "node ../services/api/dist/index.js",
      url: `${api}/health`,
      reuseExistingServer: !ci,
      timeout: 60_000,
      env: {
        PORT: "3100",
        LOG_LEVEL: "warn",
        NODE_ENV: "production",
        CORS_ORIGIN: shell,
        DEMO_LIMIT_PER_HOUR: "1000",
      },
    },
    {
      command: "npm run preview -w @crowd-pulse/qa",
      url: "http://localhost:4173/remoteEntry.js",
      reuseExistingServer: !ci,
      timeout: 60_000,
    },
    {
      command: "npm run preview -w @crowd-pulse/analytics",
      url: "http://localhost:5174/remoteEntry.js",
      reuseExistingServer: !ci,
      timeout: 60_000,
    },
    {
      command: "npm run preview -w @crowd-pulse/shell",
      url: shell,
      reuseExistingServer: !ci,
      timeout: 60_000,
    },
  ],
});
