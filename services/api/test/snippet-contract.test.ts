import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildApp } from "../src/app.js";
import { sql } from "../src/db/index.js";
import { resetDb } from "./helpers.js";

const snippetCode = readFileSync(
  new URL("../../../packages/snippet/dist/cp.js", import.meta.url),
  "utf8",
);

const app = buildApp();

beforeAll(() => app.ready());
afterAll(() => app.close());
beforeEach(() => resetDb());

async function runSnippet() {
  const blobs: Blob[] = [];
  const handlers: Record<string, (() => void)[]> = {};
  const history = { pushState() {}, replaceState() {} };
  const document = {
    currentScript: {
      getAttribute: (name: string) =>
        ({
          "data-endpoint": "https://api.example.com/collect",
          "data-room-regex": "^/(?:join|r|host/rooms)/([A-Za-z0-9]{4,12})",
        })[name] ?? null,
    },
    referrer: "https://www.linkedin.com/feed/",
    visibilityState: "visible",
    addEventListener: (type: string, handler: () => void) => {
      (handlers[type] ||= []).push(handler);
    },
  };
  const window = {
    navigator: {
      sendBeacon: (_url: string, blob: Blob) => {
        blobs.push(blob);
        return true;
      },
    },
    location: { pathname: "/join/abc123", hostname: "app.example.com" },
    history,
    setTimeout: () => 1,
    clearTimeout: () => undefined,
    fetch: () => Promise.resolve(),
    addEventListener: () => undefined,
    cp: undefined as
      | { track: (name: string, props?: Record<string, unknown>) => void }
      | undefined,
  };

  new Function("window", "document", snippetCode)(window, document);
  window.cp?.track("vote", { option: "Live polls", anonymous: false });
  window.cp?.track("question_ask", { anonymous: true });
  document.visibilityState = "hidden";
  (handlers.visibilitychange || []).forEach((handler) => handler());

  return Promise.all(blobs.map((blob) => blob.text()));
}

describe("snippet and ingest contract", () => {
  it("accepts exactly what the built snippet sends", async () => {
    const bodies = await runSnippet();
    expect(bodies).toHaveLength(1);

    const res = await app.inject({
      method: "POST",
      url: "/collect",
      headers: {
        "content-type": "text/plain;charset=UTF-8",
        "user-agent": "TestBrowser/1.0",
        "x-forwarded-for": "203.0.113.200",
      },
      payload: bodies[0],
    });

    expect(res.statusCode).toBe(204);
    const rows = await sql`select event, room_code, path, referrer_host, props from events order by id`;
    expect(rows.map((row) => row.event)).toEqual([
      "pageview",
      "vote",
      "question_ask",
    ]);
    expect(rows.every((row) => row.room_code === "ABC123")).toBe(true);
    expect(rows[0].referrer_host).toBe("www.linkedin.com");
    expect(rows[1].props).toEqual({ option: "Live polls", anonymous: false });
    expect(rows[2].props).toEqual({ anonymous: true });
  });
});
