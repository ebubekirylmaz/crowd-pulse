import { buildApp } from "./app.js";
import { deleteExpiredDemoHosts } from "./db/demoCleanup.js";
import { ensureEventPartitions } from "./analytics/partitions.js";
import { runMigrations } from "./db/migrations.js";
import { sql } from "./db/index.js";
import { startAnalyticsJobs } from "./analytics/jobs.js";

const app = buildApp();

const port = Number(process.env.PORT) || 3000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

async function start() {
  try {
    await runMigrations(sql);
    await ensureEventPartitions();
    await deleteExpiredDemoHosts();
    await app.listen({ port, host: "0.0.0.0" });
    startAnalyticsJobs(app.log);
    setInterval(() => {
      deleteExpiredDemoHosts().catch((error) => app.log.error(error));
    }, CLEANUP_INTERVAL_MS).unref();
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
