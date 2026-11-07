import { buildApp } from "../src/app.js";
import { sql } from "../src/db/index.js";

function arg(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value ?? fallback;
}

const iterations = Number(arg("iterations", "100"));

function percentile(sorted: number[], p: number) {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))];
}

async function measure(label: string, run: () => Promise<void>) {
  for (let i = 0; i < 5; i++) await run();
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const begin = performance.now();
    await run();
    times.push(performance.now() - begin);
  }
  times.sort((a, b) => a - b);
  console.log(
    `${label.padEnd(34)} p50 ${percentile(times, 50).toFixed(1).padStart(7)} ms   p95 ${percentile(times, 95).toFixed(1).padStart(7)} ms   max ${times[times.length - 1].toFixed(1).padStart(7)} ms`,
  );
}

const [{ current_database: database }] = await sql`select current_database()`;
const [{ n: eventCount }] = await sql`select count(*)::int as n from events`;
const [owner] = await sql`
  select r.host_id, count(*)::int as n
  from events e join rooms r on r.code = e.room_code
  group by r.host_id
  order by n desc
  limit 1
`;
if (!owner) {
  throw new Error("no events are attributed to a room, run seed:analytics first");
}

console.log(`${database}: ${eventCount} events, host ${owner.host_id} owns ${owner.n} of them`);
console.log(`${iterations} timed requests per row after 5 warm up requests\n`);

const app = buildApp();
await app.ready();
const token = app.jwt.sign({ sub: owner.host_id }, { expiresIn: "1h" });
const headers = { authorization: `Bearer ${token}` };

for (const range of ["24h", "7d", "30d"]) {
  await measure(`GET /analytics/overview ${range}`, async () => {
    const res = await app.inject({
      method: "GET",
      url: `/analytics/overview?range=${range}`,
      headers,
    });
    if (res.statusCode !== 200) throw new Error(`status ${res.statusCode}`);
  });
}

const [room] = await sql`select code from rooms where host_id = ${owner.host_id} order by code limit 1`;
for (const range of ["24h", "30d"]) {
  await measure(`GET /analytics/rooms/:code ${range}`, async () => {
    const res = await app.inject({
      method: "GET",
      url: `/analytics/rooms/${room.code}?range=${range}`,
      headers,
    });
    if (res.statusCode !== 200) throw new Error(`status ${res.statusCode}`);
  });
}

const codes = (await sql`select code from rooms where host_id = ${owner.host_id}`).map((row) => row.code as string);
await measure("raw events, 30d totals (compare)", async () => {
  await sql`
    select
      count(*)::int as events,
      (count(*) filter (where event = 'pageview'))::int as pageviews,
      count(distinct (visitor, occurred_at::date))::int as visitors
    from events
    where room_code = any(${sql.array(codes, 25)}) and occurred_at >= now() - interval '30 days'
  `;
});
await measure("raw events, 30d daily series (compare)", async () => {
  await sql`
    select occurred_at::date as day, count(*)::int as events, count(distinct visitor)::int as visitors
    from events
    where room_code = any(${sql.array(codes, 25)}) and occurred_at >= now() - interval '30 days'
    group by 1
    order by 1
  `;
});

await app.close();
