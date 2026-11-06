import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { generateRoomCode } from "../lib/roomCode.js";
import { redis } from "../redis.js";
import { sql } from "../db/index.js";

const LIMIT_PER_HOUR = Number(process.env.DEMO_LIMIT_PER_HOUR) || 5;
const WINDOW_SECONDS = 3600;
const POLL_QUESTION = "Which feature would you use most?";
const POLL_OPTIONS = ["Live polls", "Anonymous questions", "Presenter mode"];
const SAMPLE_QUESTIONS = [
  "Can participants join without creating an account?",
  "Does this work on a projector?",
];

async function withinRateLimit(ip: string) {
  try {
    const key = `demo:ip:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, WINDOW_SECONDS);
    return count <= LIMIT_PER_HOUR;
  } catch {
    return true;
  }
}

export default async function demoRoutes(app: FastifyInstance) {
  app.post("/demo", async (request, reply) => {
    if (!(await withinRateLimit(request.ip))) {
      return reply.code(429).send({ error: "too many demo requests" });
    }

    const passwordHash = await argon2.hash(randomBytes(32).toString("hex"));
    const email = `demo-${randomBytes(6).toString("hex")}@demo.invalid`;

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const result = await sql.begin(async (tx) => {
          const [host] =
            await tx`insert into hosts (email, password_hash, is_demo) values (${email}, ${passwordHash}, true) returning id`;
          const [room] =
            await tx`insert into rooms (host_id, code, title) values (${host.id}, ${generateRoomCode()}, 'Demo room') returning id, code`;
          const [poll] =
            await tx`insert into polls (room_id, question, status) values (${room.id}, ${POLL_QUESTION}, 'active') returning id`;
          for (let i = 0; i < POLL_OPTIONS.length; i++) {
            await tx`insert into poll_options (poll_id, label, position) values (${poll.id}, ${POLL_OPTIONS[i]}, ${i})`;
          }
          const [guest] =
            await tx`insert into participants (room_id, display_name, session_token) values (${room.id}, 'Demo guest', ${randomBytes(32).toString("hex")}) returning id`;
          for (const body of SAMPLE_QUESTIONS) {
            await tx`insert into questions (room_id, participant_id, body) values (${room.id}, ${guest.id}, ${body})`;
          }
          return { hostId: host.id as string, code: room.code as string };
        });
        const token = app.jwt.sign({ sub: result.hostId }, { expiresIn: "1d" });
        return reply.code(201).send({ token, code: result.code });
      } catch (error) {
        if ((error as { code?: string }).code !== "23505") throw error;
      }
    }
    return reply.code(500).send({ error: "failed to create demo" });
  });
}
