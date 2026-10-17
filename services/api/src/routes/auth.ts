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

  app.post("/auth/login", async (request, reply) => {
    const { success, data: parsedData } = credentialsSchema.safeParse(
      request.body,
    );
    if (!success) {
      return reply.code(400).send({ error: "invalid input" });
    }
    const { email, password } = parsedData;
    const normalizedEmail = email.toLowerCase();
    const [host] =
      await sql`select id, email, password_hash from hosts where email = ${normalizedEmail}`;
    if (!host) {
      return reply.code(401).send({ error: "invalid credentials" });
    }
    const isValid = await argon2.verify(host.password_hash, password);
    if (!isValid) {
      return reply.code(401).send({ error: "invalid credentials" });
    }
    const token = await app.jwt.sign({ sub: host.id }, { expiresIn: "7d" });
    return reply.code(200).send({ token });
  });

  app.get("/auth/me", { preHandler: app.authenticate }, async (request, reply) => {
    const [host] =
      await sql`select id, email from hosts where id = ${request.user.sub}`;
    if (!host) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    return reply.code(200).send(host);
  });
}
