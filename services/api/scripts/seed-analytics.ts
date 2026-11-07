import { randomBytes, randomInt } from "node:crypto";
import { insertEvents, type EventRow } from "../src/analytics/events.js";
import { ensureEventPartitions } from "../src/analytics/partitions.js";
import { refreshRollups } from "../src/analytics/rollups.js";
import { sql } from "../src/db/index.js";

function arg(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value ?? fallback;
}

const rooms = arg("rooms", "")
  .split(",")
  .map((code) => code.trim().toUpperCase())
  .filter(Boolean);
const days = Number(arg("days", "30"));
const totalEvents = Number(arg("events", "100000"));
const reset = process.argv.includes("--reset");
const CHUNK_SIZE = 5000;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

if (days < 1 || days > 30) {
  throw new Error("--days must be between 1 and 30, the raw retention window");
}

const MIX: [string, number, string][] = [
  ["pageview", 55, "/r"],
  ["join", 12, "/join"],
  ["vote", 15, "/r"],
  ["question_ask", 6, "/r"],
  ["question_upvote", 10, "/r"],
  ["demo_start", 2, "/"],
];
const MIX_TOTAL = MIX.reduce((sum, [, weight]) => sum + weight, 0);
const REFERRERS = [null, null, null, "linkedin.com", "github.com", "google.com"];

const hourWeights = Array.from(
  { length: 24 },
  (_, hour) => 0.2 + Math.exp(-((hour - 13) ** 2) / (2 * 4 ** 2)) * 1.8,
);
const hourTotal = hourWeights.reduce((sum, weight) => sum + weight, 0);

function pickHour() {
  let target = (randomInt(0, 1_000_000) / 1_000_000) * hourTotal;
  for (let hour = 0; hour < 24; hour++) {
    target -= hourWeights[hour];
    if (target <= 0) return hour;
  }
  return 23;
}

function pickEvent() {
  let target = randomInt(0, MIX_TOTAL);
  for (const entry of MIX) {
    target -= entry[1];
    if (target < 0) return entry;
  }
  return MIX[0];
}

function pickRoom() {
  if (rooms.length === 0) return null;
  const weights = rooms.map((_, index) => 1 / 2 ** index);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let target = (randomInt(0, 1_000_000) / 1_000_000) * total;
  for (let index = 0; index < rooms.length; index++) {
    target -= weights[index];
    if (target <= 0) return rooms[index];
  }
  return rooms[0];
}

const [{ current_database: database }] = await sql`select current_database()`;
console.log(`seeding ${database}: ${totalEvents} events over ${days} days, rooms: ${rooms.join(", ") || "none (no room attribution)"}`);

if (reset) {
  await sql`truncate events, rollup_hourly, rollup_daily, rollup_events_daily`;
  console.log("analytics tables truncated");
}

await ensureEventPartitions({ daysBack: days + 1, daysAhead: 1 });

const now = Date.now();
const todayStart = now - (now % DAY_MS);
const perDay = totalEvents / days;
let inserted = 0;
let chunk: EventRow[] = [];
const startedAt = performance.now();

async function flushChunk() {
  if (chunk.length === 0) return;
  await insertEvents(chunk);
  inserted += chunk.length;
  chunk = [];
}

for (let offset = days - 1; offset >= 0; offset--) {
  const dayStart = todayStart - offset * DAY_MS;
  const weekday = new Date(dayStart).getUTCDay();
  const weekendFactor = weekday === 0 || weekday === 6 ? 0.45 : 1;
  const dayEvents = Math.round(perDay * weekendFactor * (0.7 + Math.random() * 0.6));
  const visitors = Array.from(
    { length: Math.max(20, Math.round(dayEvents / 5)) },
    () => ({ id: randomBytes(16).toString("hex"), room: pickRoom() }),
  );

  async function emit(
    visitor: { id: string; room: string | null },
    entry: [string, number, string],
  ) {
    const [event, , basePath] = entry;
    const room = event === "demo_start" ? null : visitor.room;
    let at = dayStart + pickHour() * HOUR_MS + randomInt(0, HOUR_MS);
    if (at > now) at = now - randomInt(0, 3 * HOUR_MS);
    chunk.push({
      occurred_at: new Date(at),
      event,
      room_code: room,
      path: room && basePath !== "/" ? `${basePath}/${room}` : basePath,
      visitor: visitor.id,
      referrer_host:
        event === "pageview" ? REFERRERS[randomInt(0, REFERRERS.length)] : null,
      props: {},
    });
    if (chunk.length >= CHUNK_SIZE) await flushChunk();
  }

  for (const visitor of visitors) {
    await emit(visitor, MIX[0]);
  }
  const remaining = Math.max(0, dayEvents - visitors.length);
  for (let i = 0; i < remaining; i++) {
    await emit(visitors[randomInt(0, visitors.length)], pickEvent());
  }
}
await flushChunk();
const insertMs = performance.now() - startedAt;

const rollupStart = performance.now();
await refreshRollups({ hours: days * 24 + 24, days: days + 1 });
const rollupMs = performance.now() - rollupStart;

const [counts] = await sql`
  select
    (select count(*) from events)::int as events,
    (select count(*) from rollup_hourly)::int as hourly,
    (select count(*) from rollup_daily)::int as daily
`;
console.log(`inserted ${inserted} events in ${(insertMs / 1000).toFixed(1)} s (${Math.round(inserted / (insertMs / 1000))} per second)`);
console.log(`rollups refreshed in ${(rollupMs / 1000).toFixed(2)} s`);
console.log(`tables now hold ${counts.events} events, ${counts.hourly} hourly rollup rows, ${counts.daily} daily rollup rows`);

await sql.end();
