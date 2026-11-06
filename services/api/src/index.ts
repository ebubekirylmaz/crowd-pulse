import { buildApp } from "./app.js";
import { deleteExpiredDemoHosts } from "./db/demoCleanup.js";
import { runMigrations } from "./db/migrations.js";
import { sql } from "./db/index.js";

const app = buildApp();

const port = Number(process.env.PORT) || 3000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

async function start() {
  try {
    await runMigrations(sql);
    await deleteExpiredDemoHosts();
    await app.listen({ port, host: "0.0.0.0" });
    setInterval(() => {
      deleteExpiredDemoHosts().catch((error) => app.log.error(error));
    }, CLEANUP_INTERVAL_MS).unref();
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
