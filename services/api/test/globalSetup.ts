import postgres from "postgres";
import { runMigrations } from "../src/db/migrations.js";

export default async function setup() {
  const url = process.env.DATABASE_URL;
  const adminUrl = process.env.ADMIN_DATABASE_URL;
  if (!url || !adminUrl) {
    throw new Error("database urls are not set");
  }

  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.endsWith("_test")) {
    throw new Error(`refusing to run tests against database "${dbName}"`);
  }

  const admin = postgres(adminUrl, { onnotice: () => {} });
  const [exists] =
    await admin`select 1 from pg_database where datname = ${dbName}`;
  if (!exists) {
    await admin.unsafe(`create database "${dbName}"`);
  }
  await admin.end();

  const sql = postgres(url, { onnotice: () => {} });
  await runMigrations(sql);
  await sql.end();
}
