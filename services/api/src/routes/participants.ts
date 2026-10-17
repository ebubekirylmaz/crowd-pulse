import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { sql } from "../db/index.js";
import { z } from "zod";

const joinSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
});

export default async function participantRoutes(app: FastifyInstance) {
  app.post<{ Params: { code: string } }>(
    "/rooms/:code/join",
    async (request, reply) => {
      const { success, data: parsedData } = joinSchema.safeParse(request.body);
      if (!success) {
        return reply.code(400).send({ error: "invalid input" });
      }

      const [room] =
        await sql`select id, code, title from rooms where code = ${request.params.code.toUpperCase()}`;
      if (!room) {
        return reply.code(404).send({ error: "room not found" });
      }

      const sessionToken = randomBytes(32).toString("hex");

      const [participant] =
        await sql`insert into participants (room_id, display_name, session_token) values (${room.id}, ${parsedData.displayName}, ${sessionToken}) returning id, display_name as "displayName"`;
      return reply.code(201).send({ sessionToken, participant, room });
    },
  );
}
