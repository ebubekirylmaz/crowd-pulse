import { sql } from "../db/index.js";

const DAY_MS = 86_400_000;
const PARTITION_LOCK_ID = 727275;
const PARTITION_NAME = /^events_(\d{4})(\d{2})(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, "0");
const dayKey = (date: Date) =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
const dayIso = (date: Date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const startOfUtcDay = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

export async function ensureEventPartitions({
  daysBack = 2,
  daysAhead = 7,
  now = new Date(),
}: { daysBack?: number; daysAhead?: number; now?: Date } = {}) {
  const today = startOfUtcDay(now);
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${PARTITION_LOCK_ID})`;
    for (let offset = -daysBack; offset <= daysAhead; offset++) {
      const start = new Date(today.getTime() + offset * DAY_MS);
      const end = new Date(start.getTime() + DAY_MS);
      await tx.unsafe(
        `create table if not exists events_${dayKey(start)} partition of events for values from ('${dayIso(start)} 00:00:00+00') to ('${dayIso(end)} 00:00:00+00')`,
      );
    }
  });
}

export async function dropExpiredPartitions(
  retentionDays = 30,
  now = new Date(),
) {
  const cutoff = startOfUtcDay(new Date(now.getTime() - retentionDays * DAY_MS));
  const partitions = await sql`
    select c.relname as name
    from pg_inherits i
    join pg_class c on c.oid = i.inhrelid
    join pg_class p on p.oid = i.inhparent
    where p.relname = 'events'
  `;
  const dropped: string[] = [];
  for (const { name } of partitions) {
    const match = PARTITION_NAME.exec(name);
    if (!match) continue;
    const day = new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    );
    if (day < cutoff) {
      await sql.unsafe(`drop table ${name}`);
      dropped.push(name);
    }
  }
  return dropped;
}
