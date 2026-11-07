import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sql } from "../db/index.js";

const TEXT_OID = 25;

const querySchema = z.object({
  range: z.enum(["24h", "7d", "30d"]).default("7d"),
});

type Range = z.infer<typeof querySchema>["range"];

const RANGE_DAYS: Record<Exclude<Range, "24h">, number> = { "7d": 7, "30d": 30 };

type RoomRef = { code: string; title: string };

async function buildReport(codes: string[], range: Range) {
  const rooms = sql.array(codes, TEXT_OID);

  if (range === "24h") {
    const points = await sql`
      with hours as (
        select generate_series(
          date_trunc('hour', now() at time zone 'UTC') - interval '23 hours',
          date_trunc('hour', now() at time zone 'UTC'),
          interval '1 hour'
        ) as hour
      )
      select
        hours.hour at time zone 'UTC' as at,
        coalesce(sum(r.events), 0)::int as events,
        coalesce(sum(r.visitors), 0)::int as visitors
      from hours
      left join rollup_hourly r
        on r.bucket = hours.hour at time zone 'UTC' and r.room_code = any(${rooms})
      group by hours.hour
      order by hours.hour
    `;
    const [totals] = await sql`
      select
        count(*)::int as events,
        (count(*) filter (where event = 'pageview'))::int as pageviews,
        count(distinct visitor)::int as visitors
      from events
      where room_code = any(${rooms}) and occurred_at >= now() - interval '24 hours'
    `;
    const topEvents = await sql`
      select event, count(*)::int as events
      from events
      where room_code = any(${rooms}) and occurred_at >= now() - interval '24 hours'
      group by event
      order by events desc, event
      limit 8
    `;
    return { range, totals, series: { granularity: "hour", points }, topEvents };
  }

  const days = RANGE_DAYS[range];
  const points = await sql`
    with days as (
      select generate_series(
        (now() at time zone 'UTC')::date - ${days - 1}::int,
        (now() at time zone 'UTC')::date,
        interval '1 day'
      )::date as day
    )
    select
      days.day::text as at,
      coalesce(sum(r.events), 0)::int as events,
      coalesce(sum(r.visitors), 0)::int as visitors
    from days
    left join rollup_daily r on r.day = days.day and r.room_code = any(${rooms})
    group by days.day
    order by days.day
  `;
  const [totals] = await sql`
    select
      coalesce(sum(events), 0)::int as events,
      coalesce(sum(pageviews), 0)::int as pageviews,
      coalesce(sum(visitors), 0)::int as visitors
    from rollup_daily
    where room_code = any(${rooms}) and day >= (now() at time zone 'UTC')::date - ${days - 1}::int
  `;
  const topEvents = await sql`
    select event, sum(events)::int as events
    from rollup_events_daily
    where room_code = any(${rooms}) and day >= (now() at time zone 'UTC')::date - ${days - 1}::int
    group by event
    order by events desc, event
    limit 8
  `;
  return { range, totals, series: { granularity: "day", points }, topEvents };
}

async function totalsByRoom(codes: string[], range: Range) {
  const rooms = sql.array(codes, TEXT_OID);
  if (range === "24h") {
    return sql`
      select
        room_code,
        count(*)::int as events,
        (count(*) filter (where event = 'pageview'))::int as pageviews,
        count(distinct visitor)::int as visitors
      from events
      where room_code = any(${rooms}) and occurred_at >= now() - interval '24 hours'
      group by room_code
    `;
  }
  const days = RANGE_DAYS[range];
  return sql`
    select
      room_code,
      sum(events)::int as events,
      sum(pageviews)::int as pageviews,
      sum(visitors)::int as visitors
    from rollup_daily
    where room_code = any(${rooms}) and day >= (now() at time zone 'UTC')::date - ${days - 1}::int
    group by room_code
  `;
}

export default async function analyticsRoutes(app: FastifyInstance) {
  app.get<{ Params: { code: string } }>(
    "/analytics/rooms/:code",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const query = querySchema.safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send({ error: "invalid input" });
      }
      const [room] =
        await sql`select code, title from rooms where code = ${request.params.code.toUpperCase()} and host_id = ${request.user.sub}`;
      if (!room) {
        return reply.code(404).send({ error: "room not found" });
      }
      const report = await buildReport([room.code], query.data.range);
      return reply.code(200).send({ room, ...report });
    },
  );

  app.get(
    "/analytics/overview",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const query = querySchema.safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send({ error: "invalid input" });
      }
      const owned = (await sql`
        select code, title from rooms where host_id = ${request.user.sub} order by created_at desc
      `) as unknown as RoomRef[];
      const codes = owned.map((room) => room.code);
      const [report, perRoom] = await Promise.all([
        buildReport(codes, query.data.range),
        totalsByRoom(codes, query.data.range),
      ]);
      const totalsFor = new Map(perRoom.map((row) => [row.room_code, row]));
      const rooms = owned
        .map((room) => {
          const row = totalsFor.get(room.code);
          return {
            code: room.code,
            title: room.title,
            events: row?.events ?? 0,
            pageviews: row?.pageviews ?? 0,
            visitors: row?.visitors ?? 0,
          };
        })
        .sort((a, b) => b.visitors - a.visitors || b.events - a.events);
      return reply.code(200).send({ ...report, rooms });
    },
  );
}
