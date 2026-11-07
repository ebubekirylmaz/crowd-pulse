import { sql } from "../db/index.js";
import { ensureEventPartitions } from "./partitions.js";

export type EventRow = {
  occurred_at: Date;
  event: string;
  room_code: string | null;
  path: string;
  visitor: string;
  referrer_host: string | null;
  props: Record<string, string | number | boolean>;
};

const NO_PARTITION_FOR_ROW = "23514";

function insert(rows: EventRow[]) {
  const values = rows.map((row) => ({ ...row, props: sql.json(row.props) }));
  return sql`insert into events ${sql(
    values,
    "occurred_at",
    "event",
    "room_code",
    "path",
    "visitor",
    "referrer_host",
    "props",
  )}`;
}

export async function insertEvents(rows: EventRow[]) {
  try {
    await insert(rows);
  } catch (error) {
    if ((error as { code?: string }).code !== NO_PARTITION_FOR_ROW) throw error;
    await ensureEventPartitions();
    await insert(rows);
  }
}
