# 0005: Keep raw events for 30 days and serve the dashboard from rollups

Status: accepted

## Context

The analytics dashboard needs totals, a time series and a per-room breakdown for 24 hours, 7 days and 30 days. The same event table is written by every visitor's browser, so writes are frequent and reads come from a handful of hosts.

To see whether answering the dashboard straight from raw events is good enough, 852,083 synthetic events over 30 days (three rooms, one host) were queried with the same shape of query the API would run:

| Query over 30 days of raw events | p50 | p95 |
| --- | --- | --- |
| Totals with distinct visitors per day | 1,069 ms | 1,434 ms |
| Daily series with distinct visitors | 925 ms | 1,181 ms |

About a second per card, several cards per page, and it grows with traffic. That is too slow for a page people open to glance at.

## Decision

- Store every event in a table **partitioned by day** and keep **30 days** of it. Dropping an old day is dropping a table, which is instant and leaves no dead rows behind, where a `delete` on a table this size would not.
- Maintain three **rollup tables** (hourly per room, daily per room, and daily per event name) rebuilt by a job every minute. The refresh recomputes the affected buckets from raw events, so running it twice gives the same result and a missed run heals itself on the next one.
- Serve **7 and 30 day** ranges from the daily rollups, and the **24 hour** range from the hourly rollups for the chart and from raw events for the totals, because the totals include the current, still filling hour.
- Unique visitors are counted exactly inside each bucket. For ranges longer than a day the dashboard shows the **sum of daily uniques** and says so on the card, because the visitor identity rotates daily (see ADR 0006) and a person cannot be matched across days anyway.

## Consequences

Same data set, same machine, measured through the API (100 requests per row):

| Endpoint | p50 | p95 |
| --- | --- | --- |
| `/analytics/overview` 7 days | 1.1 ms | 1.7 ms |
| `/analytics/overview` 30 days | 1.2 ms | 1.6 ms |
| `/analytics/rooms/:code` 30 days | 1.1 ms | 1.7 ms |
| `/analytics/rooms/:code` 24 hours | 30 ms | 33 ms |
| `/analytics/overview` 24 hours | 70 ms | 111 ms |

- The long ranges are about 600 times faster than the raw queries and no longer depend on event volume, only on the number of days and rooms.
- The 24 hour range is the slowest on purpose: it reads raw events for the last day to include the current hour. It is still under 120 ms at roughly 30,000 events a day for the host. If it ever matters, the fix is to read the current hour only from raw events and the rest from the hourly rollup.
- Rollups lag by up to a minute for the chart. Totals for 24 hours are live.
- Storage grows with events for 30 days plus a small, fixed-size rollup history.
- Numbers come from one laptop with Postgres in Docker and the API called in process, so network time is not included.

## Alternatives considered

- **Live aggregation only**: simplest, and fine for a few thousand events, but the measurements above show it stops being interactive at under a million.
- **ClickHouse or another column store**: the right tool at hundreds of millions of events or free-form filtering. Here it would add a second database to run and keep in sync for a dashboard whose queries are fixed. The rollup tables are the same idea at a size Postgres handles easily, and the migration path is clear if the volume ever changes.
- **Rollups only, no raw events**: cheaper, but any new metric would start from zero and a bug in the aggregation could not be repaired.
- **Incremental counters on every write**: lowest read latency, but hot rows under concurrent writes and no way to recompute after a mistake.
