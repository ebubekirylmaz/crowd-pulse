import { readFile, readdir } from "node:fs/promises";

import { fileURLToPath } from "node:url";
import path from "node:path";
import type postgres from "postgres";

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../migrations",
);

export async function runMigrations(sql: postgres.Sql) {
  await sql`create table if not exists migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`;

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const migrations = await sql`select name from migrations`;
  const pendingMigrations = files.filter(
    (file) => !migrations.some((m) => m.name === file),
  );

  for (const file of pendingMigrations) {
    const content = await readFile(path.join(migrationsDir, file), "utf-8");
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`insert into migrations (name) values (${file})`;
    });
  }
}
