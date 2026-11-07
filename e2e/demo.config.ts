import { defineConfig } from "@playwright/test";
import base from "./playwright.config.ts";

export default defineConfig({
  ...base,
  testDir: "./demo",
  timeout: 180_000,
  retries: 0,
  reporter: "list",
});
