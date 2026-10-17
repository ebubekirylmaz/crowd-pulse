import Fastify from "fastify";
import { redis } from "./redis.js";
import { sql } from "./db/index.js";
const app = Fastify({
  logger: true,
});

app.get("/health", async (_req, reply) => {
  const [dbResult, redisResult] = await Promise.allSettled([
    sql`select 1`,
    redis.ping(),
  ]);
  const db = dbResult.status === "fulfilled" ? "ok" : "error";
  const redisStatus = redisResult.status === "fulfilled" ? "ok" : "error";
  const healthy = db === "ok" && redisStatus === "ok";

  return reply
    .code(healthy ? 200 : 503)
    .send({ status: healthy ? "ok" : "error", db, redis: redisStatus });
});

const port = Number(process.env.PORT) || 3000;

async function start() {
  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
