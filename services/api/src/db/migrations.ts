import { readFile, readdir } from "node:fs/promises";

import { fileURLToPath } from "node:url";
import path from "node:path";
import type postgres from "postgres";

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../migrations",
);

const MIGRATION_LOCK_ID = 727274;

export async function runMigrations(sql: postgres.Sql) {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${MIGRATION_LOCK_ID})`;
    await tx`create table if not exists migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`;

    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const applied = await tx`select name from migrations`;
    const pending = files.filter(
      (file) => !applied.some((m) => m.name === file),
    );

    for (const file of pending) {
      const content = await readFile(path.join(migrationsDir, file), "utf-8");
      await tx.unsafe(content);
      await tx`insert into migrations (name) values (${file})`;
    }
  });
}
