import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { insertEvents, type EventRow } from "../src/analytics/events.js";
import {
  dropExpiredPartitions,
  ensureEventPartitions,
} from "../src/analytics/partitions.js";
import { refreshRollups } from "../src/analytics/rollups.js";
import { visitorHash } from "../src/analytics/visitor.js";
import { sql } from "../src/db/index.js";
import { bearer, createRoom, registerHost, resetDb } from "./helpers.js";

const app = buildApp();

beforeAll(() => app.ready());
afterAll(() => app.close());
beforeEach(() => resetDb());

const randomIp = () =>
  `203.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 254) + 1}`;

const pageview = { name: "pageview", path: "/join/ABC123", room: "ABC123" };

function collect(
  payload: unknown,
  headers: Record<string, string> = {},
  ip = randomIp(),
) {
  return app.inject({
    method: "POST",
    url: "/collect",
    headers: {
      "x-forwarded-for": ip,
      "user-agent": "TestBrowser/1.0",
      ...headers,
    },
    payload: payload as object,
  });
}

function row(
  roomCode: string | null,
  event: string,
  visitor: string,
  at: Date,
): EventRow {
  return {
    occurred_at: at,
    event,
    room_code: roomCode,
    path: "/",
    visitor,
    referrer_host: null,
    props: {},
  };
}

describe("collect", () => {
  it("stores a batch and never keeps the ip address", async () => {
    const ip = "203.0.113.77";
    const res = await collect(
      {
        events: [
          { ...pageview, referrer: "linkedin.com" },
          {
            name: "vote",
            path: "/r/ABC123",
            room: "ABC123",
            props: { option: "Live polls", count: 1, anonymous: false },
          },
        ],
      },
      {},
      ip,
    );

    expect(res.statusCode).toBe(204);
    const rows = await sql`select * from events order by id`;
    expect(rows).toHaveLength(2);
    expect(rows[0].referrer_host).toBe("linkedin.com");
    expect(rows[1].props).toEqual({
      option: "Live polls",
      count: 1,
      anonymous: false,
    });
    const leaks = await sql`select count(*)::int as n from events where events::text like ${`%${ip}%`}`;
    expect(leaks[0].n).toBe(0);
  });

  it("accepts the text/plain body that sendBeacon produces", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/collect",
      headers: {
        "content-type": "text/plain;charset=UTF-8",
        "x-forwarded-for": randomIp(),
        "user-agent": "TestBrowser/1.0",
      },
      payload: JSON.stringify({ events: [pageview] }),
    });

    expect(res.statusCode).toBe(204);
    const rows = await sql`select event from events`;
    expect(rows).toHaveLength(1);
  });

  it("recognises the same browser within a day and rotates the identity daily", async () => {
    const ip = randomIp();
    await collect({ events: [pageview] }, {}, ip);
    await collect({ events: [pageview] }, {}, ip);
    await collect(
      { events: [pageview] },
      { "user-agent": "OtherBrowser/2.0" },
      ip,
    );

    const visitors = await sql`select visitor from events order by id`;
    expect(visitors[0].visitor).toBe(visitors[1].visitor);
    expect(visitors[2].visitor).not.toBe(visitors[0].visitor);
    expect(visitors[0].visitor).toMatch(/^[0-9a-f]{32}$/);

    const dayOne = visitorHash(ip, "TestBrowser/1.0", new Date("2026-11-07T12:00:00Z"));
    const dayTwo = visitorHash(ip, "TestBrowser/1.0", new Date("2026-11-08T12:00:00Z"));
    expect(dayOne).not.toBe(dayTwo);
  });

  it("rejects malformed batches", async () => {
    const tooMany = Array.from({ length: 21 }, () => pageview);
    const cases = [
      { events: [] },
      { events: tooMany },
      { events: [{ name: "Not Valid!", path: "/" }] },
      { events: [{ name: "pageview", path: "no-leading-slash" }] },
      { events: [{ name: "pageview", path: "/", room: "bad room" }] },
      { nope: true },
    ];
    for (const body of cases) {
      const res = await collect(body);
      expect(res.statusCode).toBe(400);
    }
    const rows = await sql`select count(*)::int as n from events`;
    expect(rows[0].n).toBe(0);
  });

  it("honours Do Not Track and ignores bots", async () => {
    const dnt = await collect({ events: [pageview] }, { dnt: "1" });
    const gpc = await collect({ events: [pageview] }, { "sec-gpc": "1" });
    const bot = await collect(
      { events: [pageview] },
      { "user-agent": "Googlebot/2.1" },
    );

    expect([dnt.statusCode, gpc.statusCode, bot.statusCode]).toEqual([204, 204, 204]);
    const rows = await sql`select count(*)::int as n from events`;
    expect(rows[0].n).toBe(0);
  });

  it("rate limits each ip", async () => {
    const previous = process.env.COLLECT_LIMIT_PER_MINUTE;
    process.env.COLLECT_LIMIT_PER_MINUTE = "3";
    try {
      const ip = randomIp();
      const statuses: number[] = [];
      for (let i = 0; i < 5; i++) {
        statuses.push((await collect({ events: [pageview] }, {}, ip)).statusCode);
      }
      const other = await collect({ events: [pageview] }, {}, randomIp());

      expect(statuses).toEqual([204, 204, 204, 429, 429]);
      expect(other.statusCode).toBe(204);
    } finally {
      if (previous === undefined) delete process.env.COLLECT_LIMIT_PER_MINUTE;
      else process.env.COLLECT_LIMIT_PER_MINUTE = previous;
    }
  });
});

describe("partitions", () => {
  it("creates a missing partition on demand", async () => {
    const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    await sql.unsafe(`drop table if exists events_${today}`);

    const res = await collect({ events: [pageview] });

    expect(res.statusCode).toBe(204);
    const rows = await sql`select count(*)::int as n from events`;
    expect(rows[0].n).toBe(1);
  });

  it("drops partitions older than the retention window and keeps recent ones", async () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000);
    await ensureEventPartitions({ now: sixtyDaysAgo, daysBack: 0, daysAhead: 0 });
    await ensureEventPartitions({ daysBack: 0, daysAhead: 0 });

    const dropped = await dropExpiredPartitions(30);

    const oldName = `events_${sixtyDaysAgo.toISOString().slice(0, 10).replaceAll("-", "")}`;
    const todayName = `events_${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`;
    expect(dropped).toContain(oldName);
    expect(dropped).not.toContain(todayName);
    const remaining = await sql`select relname from pg_class where relname = ${todayName}`;
    expect(remaining).toHaveLength(1);
  });
});

describe("rollups", () => {
  it("aggregates hourly and daily counts, exact visitors included, and is idempotent", async () => {
    const at = new Date(Date.now() - 2 * 3_600_000);
    await insertEvents([
      row("AAA111", "pageview", "v1", at),
      row("AAA111", "pageview", "v1", at),
      row("AAA111", "vote", "v2", at),
      row("BBB222", "pageview", "v3", at),
      row(null, "pageview", "v4", at),
    ]);

    await refreshRollups();
    const firstHourly = await sql`select room_code, events, pageviews, visitors from rollup_hourly order by room_code`;
    await refreshRollups();
    const secondHourly = await sql`select room_code, events, pageviews, visitors from rollup_hourly order by room_code`;

    expect(firstHourly.map((r) => ({ ...r }))).toEqual([
      { room_code: "", events: 1, pageviews: 1, visitors: 1 },
      { room_code: "AAA111", events: 3, pageviews: 2, visitors: 2 },
      { room_code: "BBB222", events: 1, pageviews: 1, visitors: 1 },
    ]);
    expect(secondHourly.map((r) => ({ ...r }))).toEqual(firstHourly.map((r) => ({ ...r })));

    const daily = await sql`select events, pageviews, visitors from rollup_daily where room_code = 'AAA111'`;
    expect({ ...daily[0] }).toEqual({ events: 3, pageviews: 2, visitors: 2 });

    const breakdown = await sql`select event, events from rollup_events_daily where room_code = 'AAA111' order by event`;
    expect(breakdown.map((r) => ({ ...r }))).toEqual([
      { event: "pageview", events: 2 },
      { event: "vote", events: 1 },
    ]);
  });
});

describe("analytics api", () => {
  async function seededRoom(email: string) {
    const token = await registerHost(app, email);
    const room = await createRoom(app, token);
    const at = new Date(Date.now() - 2 * 3_600_000);
    await insertEvents([
      row(room.code, "pageview", "v1", at),
      row(room.code, "pageview", "v1", at),
      row(room.code, "vote", "v2", at),
    ]);
    return { token, room };
  }

  it("requires a host token", async () => {
    const res = await app.inject({ method: "GET", url: "/analytics/overview" });
    expect(res.statusCode).toBe(401);
  });

  it("reports a room over seven days with a continuous series", async () => {
    const { token, room } = await seededRoom("host@example.com");
    await refreshRollups();

    const res = await app.inject({
      method: "GET",
      url: `/analytics/rooms/${room.code}?range=7d`,
      headers: bearer(token),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totals).toEqual({ events: 3, pageviews: 2, visitors: 2 });
    expect(body.series.granularity).toBe("day");
    expect(body.series.points).toHaveLength(7);
    const total = body.series.points.reduce(
      (sum: number, point: { events: number }) => sum + point.events,
      0,
    );
    expect(total).toBe(3);
    expect(body.topEvents).toEqual([
      { event: "pageview", events: 2 },
      { event: "vote", events: 1 },
    ]);
  });

  it("reports the last 24 hours hourly", async () => {
    const { token, room } = await seededRoom("host@example.com");
    await refreshRollups();

    const res = await app.inject({
      method: "GET",
      url: `/analytics/rooms/${room.code}?range=24h`,
      headers: bearer(token),
    });

    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(body.series.granularity).toBe("hour");
    expect(body.series.points).toHaveLength(24);
    expect(body.totals).toEqual({ events: 3, pageviews: 2, visitors: 2 });
  });

  it("hides another host's room and rejects bad ranges", async () => {
    const owner = await seededRoom("owner@example.com");
    const other = await registerHost(app, "other@example.com");

    const foreign = await app.inject({
      method: "GET",
      url: `/analytics/rooms/${owner.room.code}`,
      headers: bearer(other),
    });
    const badRange = await app.inject({
      method: "GET",
      url: `/analytics/rooms/${owner.room.code}?range=1y`,
      headers: bearer(owner.token),
    });

    expect(foreign.statusCode).toBe(404);
    expect(badRange.statusCode).toBe(400);
  });

  it("lists only the host's own rooms in the overview, busiest first", async () => {
    const mine = await seededRoom("mine@example.com");
    const quiet = await createRoom(app, mine.token);
    await seededRoom("someone-else@example.com");
    await refreshRollups();

    const res = await app.inject({
      method: "GET",
      url: "/analytics/overview?range=7d",
      headers: bearer(mine.token),
    });

    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(body.rooms.map((r: { code: string }) => r.code)).toEqual([
      mine.room.code,
      quiet.code,
    ]);
    expect(body.rooms[0]).toMatchObject({ events: 3, pageviews: 2, visitors: 2 });
    expect(body.rooms[1]).toMatchObject({ events: 0, visitors: 0 });
    expect(body.totals.events).toBe(3);
  });

  it("returns an empty overview for a host without rooms", async () => {
    const token = await registerHost(app, "new@example.com");

    const res = await app.inject({
      method: "GET",
      url: "/analytics/overview?range=24h",
      headers: bearer(token),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().rooms).toEqual([]);
    expect(res.json().totals.events).toBe(0);
  });
});
