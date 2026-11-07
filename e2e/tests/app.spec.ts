import { expect, test, type APIRequestContext } from "@playwright/test";

const API = "http://localhost:3100";
const TOKEN_KEY = "cp:host-token";

async function registerHost(request: APIRequestContext) {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = "password123";
  await request.post(`${API}/auth/register`, { data: { email, password } });
  const login = await request.post(`${API}/auth/login`, {
    data: { email, password },
  });
  const { token } = await login.json();
  return token as string;
}

test("a vote in the Q&A module reaches the analytics collector through the event bridge", async ({
  page,
  browser,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the live demo" }).click();
  await page.waitForURL(/\/host\/rooms\/[A-Z0-9]+$/);
  const code = page.url().split("/").pop()!;
  await expect(page.getByText("0 votes total")).toBeVisible();

  const participant = await browser.newContext();
  const phone = await participant.newPage();
  await phone.goto(`/join/${code}`);
  await phone.getByPlaceholder("e.g. Alex").fill("Alex");
  await phone.getByRole("button", { name: "Join", exact: true }).click();
  await phone.waitForURL(`**/r/${code}`);

  const options = phone.locator("section[aria-labelledby='poll-heading'] ul button");
  await expect(options.first()).toBeVisible();
  await options.first().click();
  await expect(phone.getByText("Your vote is saved")).toBeVisible();

  await expect(page.getByText("1 vote total")).toBeVisible();

  const hostToken = await page.evaluate(
    (key) => localStorage.getItem(key),
    TOKEN_KEY,
  );
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `${API}/analytics/rooms/${code}?range=24h`,
          { headers: { authorization: `Bearer ${hostToken}` } },
        );
        const report = await res.json();
        return (report.topEvents as { event: string; events: number }[]).find(
          (entry) => entry.event === "vote",
        )?.events;
      },
      { timeout: 15_000 },
    )
    .toBe(1);
  await participant.close();
});

test("the analytics module shows what the collector received", async ({
  page,
  request,
}) => {
  const token = await registerHost(request);
  const room = await (
    await request.post(`${API}/rooms`, {
      headers: { authorization: `Bearer ${token}` },
      data: { title: "E2E analytics room" },
    })
  ).json();

  const send = (ip: string, events: object[]) =>
    request.post(`${API}/collect`, {
      headers: {
        "content-type": "text/plain;charset=UTF-8",
        "user-agent": "Mozilla/5.0 E2E",
        "x-forwarded-for": ip,
      },
      data: JSON.stringify({ events }),
    });
  const pageview = { name: "pageview", path: `/r/${room.code}`, room: room.code };
  expect((await send("198.51.100.10", [pageview, pageview])).status()).toBe(204);
  expect(
    (await send("198.51.100.11", [pageview, { ...pageview, name: "vote" }])).status(),
  ).toBe(204);

  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [TOKEN_KEY, token],
  );
  await page.goto("/host/analytics");
  await page.getByRole("button", { name: "24 hours" }).click();

  const row = page.getByRole("row", { name: /E2E analytics room/ });
  await expect(row).toBeVisible();
  await expect(row.getByRole("cell", { name: "2", exact: true })).toBeVisible();
  await expect(row.getByRole("cell", { name: "3", exact: true })).toBeVisible();
  await expect(row.getByRole("cell", { name: "4", exact: true })).toBeVisible();
});

test("a failing analytics module leaves the rest of the app working", async ({
  page,
  request,
}) => {
  const token = await registerHost(request);
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [TOKEN_KEY, token],
  );
  await page.route("http://localhost:5174/**", (route) => route.abort());

  await page.goto("/host/analytics");
  await expect(page.getByText("Analytics is unavailable")).toBeVisible();

  await page.getByRole("link", { name: "My rooms" }).click();
  await expect(page.getByRole("heading", { name: "My rooms" })).toBeVisible();
});

test("the theme toggle overrides the system theme and is remembered", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveClass(/dark/);

  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(html).not.toHaveClass(/dark/);
  const background = () =>
    page.locator("body").evaluate((body) => getComputedStyle(body).backgroundColor);
  const light = await background();

  await page.reload();
  await expect(html).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(html).toHaveClass(/dark/);
  expect(await background()).not.toBe(light);
});
