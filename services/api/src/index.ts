import { buildApp } from "./app.js";
import { runMigrations } from "./db/migrations.js";
import { sql } from "./db/index.js";

const app = buildApp();

const port = Number(process.env.PORT) || 3000;

async function start() {
  try {
    await runMigrations(sql);
    await app.listen({ port, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
