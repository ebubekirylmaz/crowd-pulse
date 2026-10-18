import type { FastifyInstance } from "fastify";
import { getPollResults } from "../db/pollResults.js";
import { sql } from "../db/index.js";
import { z } from "zod";

const createPollSchema = z.object({
  question: z.string().trim().min(1).max(200),
  options: z.array(z.string().trim().min(1).max(100)).min(2).max(10),
});

const pollIdSchema = z.object({
  id: z.string().uuid(),
});

async function findOwnedPoll(pollId: string, hostId: string) {
  const [poll] =
    await sql`select p.id, p.room_id from polls p join rooms r on r.id = p.room_id where p.id = ${pollId} and r.host_id = ${hostId}`;
  return poll;
}

export default async function pollRoutes(app: FastifyInstance) {
  app.post<{ Params: { code: string } }>(
    "/rooms/:code/polls",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { success, data: parsedData } = createPollSchema.safeParse(
        request.body,
      );
      if (!success) {
        return reply.code(400).send({ error: "invalid input" });
      }

      const [room] =
        await sql`select id from rooms where code = ${request.params.code.toUpperCase()} and host_id = ${request.user.sub}`;
      if (!room) {
        return reply.code(404).send({ error: "room not found" });
      }

      const result = await sql.begin(async (tx) => {
        const [poll] =
          await tx`insert into polls (room_id, question) values (${room.id}, ${parsedData.question}) returning id, question, status`;
        const options = [];
        for (let i = 0; i < parsedData.options.length; i++) {
          const [option] =
            await tx`insert into poll_options (poll_id, label, position) values (${poll.id}, ${parsedData.options[i]}, ${i}) returning id, label, position`;
          options.push(option);
        }
        return { poll, options };
      });
      return reply.code(201).send(result);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/polls/:id/activate",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { success, data: parsedData } = pollIdSchema.safeParse(
        request.params,
      );
      if (!success) {
        return reply.code(400).send({ error: "invalid input" });
      }

      const owned = await findOwnedPoll(parsedData.id, request.user.sub);
      if (!owned) {
        return reply.code(404).send({ error: "poll not found" });
      }

      const poll = await sql.begin(async (tx) => {
        await tx`update polls set status = 'closed' where room_id = ${owned.room_id} and status = 'active'`;
        const [activated] =
          await tx`update polls set status = 'active' where id = ${owned.id} returning id, question, status`;
        return activated;
      });
      app.io.to(`room:${owned.room_id}`).emit("poll:activated", { poll });
      return reply.code(200).send({ poll });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/polls/:id/close",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { success, data: parsedData } = pollIdSchema.safeParse(
        request.params,
      );
      if (!success) {
        return reply.code(400).send({ error: "invalid input" });
      }

      const owned = await findOwnedPoll(parsedData.id, request.user.sub);
      if (!owned) {
        return reply.code(404).send({ error: "poll not found" });
      }

      const [poll] =
        await sql`update polls set status = 'closed' where id = ${owned.id} returning id, question, status`;
      app.io.to(`room:${owned.room_id}`).emit("poll:closed", { poll });
      return reply.code(200).send({ poll });
    },
  );

  app.get<{ Params: { code: string } }>(
    "/rooms/:code/polls/active",
    async (request, reply) => {
      const [room] =
        await sql`select id from rooms where code = ${request.params.code.toUpperCase()}`;
      if (!room) {
        return reply.code(404).send({ error: "room not found" });
      }

      const [poll] =
        await sql`select id, question from polls where room_id = ${room.id} and status = 'active'`;
      if (!poll) {
        return reply.code(404).send({ error: "no active poll" });
      }

      const options = await getPollResults(poll.id);
      return reply.code(200).send({ poll, options });
    },
  );
}
