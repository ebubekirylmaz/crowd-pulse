import Fastify, { FastifyReply, FastifyRequest } from "fastify";

import authRoutes from "./routes/auth.js";
import jwt from "@fastify/jwt";
import participantRoutes from "./routes/participants.js";
import pollRoutes from "./routes/polls.js";
import { redis } from "./redis.js";
import roomRoutes from "./routes/rooms.js";
import { setupRealtime } from "./realtime.js";
import { sql } from "./db/index.js";

const app = Fastify({
  logger: true,
});

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error("JWT_SECRET is not set");
}

app.register(jwt, { secret: jwtSecret });
app.decorate(
  "authenticate",
  async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "unauthorized" });
    }
  },
);
app.register(authRoutes);
app.register(roomRoutes);
app.register(participantRoutes);
app.register(pollRoutes);

setupRealtime(app);

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
