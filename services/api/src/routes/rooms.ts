import type { FastifyInstance } from "fastify";
import { getQuestions } from "../db/questions.js";
import { randomInt } from "node:crypto";
import { sql } from "../db/index.js";
import { z } from "zod";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(length = 6): string {
  return Array.from(
    { length },
    () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)],
  ).join("");
}

const createRoomSchema = z.object({
  title: z.string().trim().min(1).max(100),
});

export default async function roomRoutes(app: FastifyInstance) {
  app.post(
    "/rooms",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { success, data: parsedData } = createRoomSchema.safeParse(
        request.body,
      );
      if (!success) {
        return reply.code(400).send({ error: "invalid input" });
      }
      const { title } = parsedData;
      for (let i = 0; i < 5; i++) {
        const code = generateCode();
        try {
          const [room] =
            await sql`insert into rooms (host_id, code, title) values (${request.user.sub}, ${code}, ${title}) returning id, code, title, created_at`;
          return reply.code(201).send(room);
        } catch (error) {
          if ((error as { code?: string }).code !== "23505") {
            throw error;
          }
        }
      }
      return reply.code(500).send({ error: "failed to create room" });
    },
  );

  app.get("/rooms", { preHandler: app.authenticate }, async (request) => {
    return sql`select id, code, title, created_at from rooms where host_id = ${request.user.sub} order by created_at desc`;
  });

  app.get<{ Params: { code: string } }>(
    "/rooms/:code",
    async (request, reply) => {
      const { code } = request.params;
      const [room] =
        await sql`select id, code, title from rooms where code = ${code.toUpperCase()}`;
      if (!room) {
        return reply.code(404).send({ error: "room not found" });
      }
      return reply.code(200).send(room);
    },
  );

  app.get<{ Params: { code: string } }>(
    "/rooms/:code/questions",
    async (request, reply) => {
      const { code } = request.params;
      const [room] =
        await sql`select id from rooms where code = ${code.toUpperCase()}`;
      if (!room) {
        return reply.code(404).send({ error: "room not found" });
      }
      return reply.code(200).send(await getQuestions(room.id));
    },
  );
}
