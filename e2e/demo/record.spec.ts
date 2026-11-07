import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { startCapture } from "./capture.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "..", "demo-output");
const apiDir = path.resolve(here, "..", "..", "services", "api");

const HOST = { width: 1000, height: 720 };
const PHONE = { width: 360, height: 720 };

test("record the product demo", async ({ browser }) => {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const hostContext = await browser.newContext({
    viewport: HOST,
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  const phoneContext = await browser.newContext({
    viewport: PHONE,
    deviceScaleFactor: 2,
    colorScheme: "light",
    hasTouch: true,
  });
  const host = await hostContext.newPage();
  const phone = await phoneContext.newPage();
  const pause = (ms: number) => host.waitForTimeout(ms);

  const marks: Record<string, number> = {};
  const mark = (name: string) => {
    marks[name] = Date.now() / 1000;
  };

  const stopHost = await startCapture(host, path.join(out, "host"));
  const stopPhone = await startCapture(phone, path.join(out, "phone"));
  mark("start");

  await Promise.all([host.goto("/"), phone.goto("/")]);
  await pause(2500);

  await host.getByRole("button", { name: "Try the live demo" }).click();
  await host.waitForURL(/\/host\/rooms\/[A-Z0-9]+$/);
  const code = host.url().split("/").pop()!;
  mark("room_ready");
  await pause(2000);

  execFileSync(
    "npx",
    [
      "tsx",
      "scripts/seed-analytics.ts",
      "--rooms",
      code,
      "--days",
      "30",
      "--events",
      "40000",
    ],
    { cwd: apiDir, stdio: "ignore", env: process.env },
  );

  mark("present_open");
  await host.getByRole("link", { name: /Present/ }).click();
  await host.waitForURL(`**/present`);
  await pause(2500);

  mark("phone_join");
  await phone.goto(`/join/${code}`);
  await pause(1500);
  await phone.getByPlaceholder("e.g. Alex").pressSequentially("Alex", { delay: 140 });
  await pause(500);
  await phone.getByRole("button", { name: "Join", exact: true }).click();
  await phone.waitForURL(`**/r/${code}`);
  await pause(2500);

  const options = phone.locator("section[aria-labelledby='poll-heading'] ul button");
  mark("vote_start");
  await options.nth(1).click();
  mark("vote_done");
  await pause(4000);

  mark("exit_presenter");
  await host.getByRole("link", { name: "Exit" }).click();
  await host.waitForURL(`**/host/rooms/${code}`);
  await host.getByRole("heading", { name: "Questions" }).scrollIntoViewIfNeeded();
  await pause(1500);

  const question = "How does it handle 5,000 people at once?";
  mark("question_start");
  const field = phone.getByLabel("Write your question");
  await field.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await pause(700);
  await field.pressSequentially(question, { delay: 55 });
  await pause(600);
  mark("question_sent");
  await phone.getByRole("button", { name: "Send", exact: true }).click();
  await host.getByText(question).waitFor();
  await host
    .getByText(question)
    .evaluate((element) => element.scrollIntoView({ block: "center" }));
  mark("question_visible");
  await pause(3000);

  mark("answer_click");
  await host
    .getByText(question)
    .locator("xpath=ancestor::*[.//button[normalize-space()='Mark answered']][1]")
    .getByRole("button", { name: "Mark answered" })
    .click();
  await pause(2500);

  mark("dark_toggle");
  await host.getByRole("button", { name: "Switch to dark mode" }).click();
  await phone.getByRole("button", { name: "Switch to dark mode" }).click();
  await pause(2500);

  await host.getByRole("link", { name: /Analytics/ }).first().click();
  await host.waitForURL(`**/host/analytics/${code}`);
  await host.getByText("Visitors over time").waitFor();
  mark("analytics_ready");
  await pause(2500);
  mark("thirty_days");
  await host.getByRole("button", { name: "30 days" }).click();
  await pause(4000);
  mark("end");

  const hostFrames = await stopHost();
  const phoneFrames = await stopPhone();
  writeFileSync(
    path.join(out, "marks.json"),
    JSON.stringify({ marks, hostFrames, phoneFrames }, null, 2),
  );
  await hostContext.close();
  await phoneContext.close();
});
