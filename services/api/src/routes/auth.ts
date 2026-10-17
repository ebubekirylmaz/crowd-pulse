import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { sql } from "../db/index.js";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export default async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const { success, data: parsedData } = credentialsSchema.safeParse(
      request.body,
    );
    if (!success) {
      return reply.code(400).send({ error: "invalid input" });
    }
    const { email, password } = parsedData;
    const normalizedEmail = email.toLowerCase();
    const passwordHash = await argon2.hash(password);
    try {
      const [host] =
        await sql`insert into hosts (email, password_hash) values (${normalizedEmail}, ${passwordHash}) returning id, email`;
      return reply.code(201).send(host);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: "email already registered" });
      }
      throw error;
    }
  });
}
