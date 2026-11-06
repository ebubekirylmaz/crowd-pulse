import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getQuestion } from "../db/questions.js";
import { sql } from "../db/index.js";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const bodySchema = z.object({
  answered: z.boolean(),
});

export default async function questionRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    "/questions/:id/answered",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = paramsSchema.safeParse(request.params);
      const body = bodySchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.code(400).send({ error: "invalid input" });
      }

      const [owned] =
        await sql`select q.id, q.room_id from questions q join rooms r on r.id = q.room_id where q.id = ${params.data.id} and r.host_id = ${request.user.sub}`;
      if (!owned) {
        return reply.code(404).send({ error: "question not found" });
      }

      await sql`update questions set answered_at = case when ${body.data.answered}::boolean then now() else null end where id = ${owned.id}`;
      const question = await getQuestion(owned.id);
      app.io.to(`room:${owned.room_id}`).emit("question:updated", question);
      return reply.code(200).send(question);
    },
  );
}
