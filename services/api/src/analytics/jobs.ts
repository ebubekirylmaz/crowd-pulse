import { dropExpiredPartitions, ensureEventPartitions } from "./partitions.js";
import { refreshRollups } from "./rollups.js";

const ROLLUP_INTERVAL_MS = 60 * 1000;
const PARTITION_INTERVAL_MS = 60 * 60 * 1000;

async function maintainPartitions() {
  await ensureEventPartitions();
  await dropExpiredPartitions();
}

export function startAnalyticsJobs(log: { error: (error: unknown) => void }) {
  const run = (task: () => Promise<unknown>) => {
    task().catch((error) => log.error(error));
  };

  run(maintainPartitions);
  run(refreshRollups);
  setInterval(() => run(refreshRollups), ROLLUP_INTERVAL_MS).unref();
  setInterval(() => run(maintainPartitions), PARTITION_INTERVAL_MS).unref();
}
