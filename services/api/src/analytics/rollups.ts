import { sql } from "../db/index.js";

const ROLLUP_LOCK_ID = 727276;

export async function refreshRollups({
  hours = 48,
  days = 3,
}: { hours?: number; days?: number } = {}) {
  return sql.begin(async (tx) => {
    const [{ locked }] =
      await tx`select pg_try_advisory_xact_lock(${ROLLUP_LOCK_ID}) as locked`;
    if (!locked) return false;

    await tx`
      insert into rollup_hourly (bucket, room_code, events, pageviews, visitors)
      select
        date_trunc('hour', occurred_at at time zone 'UTC') at time zone 'UTC',
        coalesce(room_code, ''),
        count(*)::int,
        (count(*) filter (where event = 'pageview'))::int,
        count(distinct visitor)::int
      from events
      where occurred_at >= (date_trunc('hour', now() at time zone 'UTC') - make_interval(hours => ${hours})) at time zone 'UTC'
      group by 1, 2
      on conflict (bucket, room_code) do update set
        events = excluded.events,
        pageviews = excluded.pageviews,
        visitors = excluded.visitors
    `;

    await tx`
      insert into rollup_daily (day, room_code, events, pageviews, visitors)
      select
        (occurred_at at time zone 'UTC')::date,
        coalesce(room_code, ''),
        count(*)::int,
        (count(*) filter (where event = 'pageview'))::int,
        count(distinct visitor)::int
      from events
      where occurred_at >= (date_trunc('day', now() at time zone 'UTC') - make_interval(days => ${days})) at time zone 'UTC'
      group by 1, 2
      on conflict (day, room_code) do update set
        events = excluded.events,
        pageviews = excluded.pageviews,
        visitors = excluded.visitors
    `;

    await tx`
      insert into rollup_events_daily (day, room_code, event, events)
      select
        (occurred_at at time zone 'UTC')::date,
        coalesce(room_code, ''),
        event,
        count(*)::int
      from events
      where occurred_at >= (date_trunc('day', now() at time zone 'UTC') - make_interval(days => ${days})) at time zone 'UTC'
      group by 1, 2, 3
      on conflict (day, room_code, event) do update set events = excluded.events
    `;

    return true;
  });
}
