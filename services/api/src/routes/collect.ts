import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { insertEvents, type EventRow } from "../analytics/events.js";
import { withinCollectLimit } from "../analytics/rateLimit.js";
import { visitorHash } from "../analytics/visitor.js";

const BOT_PATTERN = /bot|crawl|spider|slurp|headless|preview/i;

const propsSchema = z
  .record(
    z.string().max(40),
    z.union([z.string().max(100), z.number(), z.boolean()]),
  )
  .refine((props) => Object.keys(props).length <= 10);

const eventSchema = z.object({
  name: z.string().regex(/^[a-z0-9_:-]{1,40}$/),
  path: z.string().max(200).startsWith("/"),
  room: z.string().regex(/^[A-Z0-9]{4,12}$/).optional(),
  referrer: z.string().max(100).optional(),
  props: propsSchema.optional(),
  age: z.number().int().min(0).max(86_400_000).optional(),
});

const batchSchema = z.object({
  events: z.array(eventSchema).min(1).max(20),
});

function parseBody(body: unknown) {
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export default async function collectRoutes(app: FastifyInstance) {
  app.post("/collect", { bodyLimit: 10_000 }, async (request, reply) => {
    if (request.headers["dnt"] === "1" || request.headers["sec-gpc"] === "1") {
      return reply.code(204).send();
    }
    if (!(await withinCollectLimit(request.ip))) {
      return reply.code(429).send({ error: "rate limited" });
    }

    const userAgent = String(request.headers["user-agent"] ?? "");
    if (BOT_PATTERN.test(userAgent)) {
      return reply.code(204).send();
    }

    const parsed = batchSchema.safeParse(parseBody(request.body));
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid input" });
    }

    const visitor = visitorHash(request.ip, userAgent);
    const now = Date.now();
    const rows: EventRow[] = parsed.data.events.map((event) => ({
      occurred_at: new Date(now - (event.age ?? 0)),
      event: event.name,
      room_code: event.room ?? null,
      path: event.path,
      visitor,
      referrer_host: event.referrer ?? null,
      props: event.props ?? {},
    }));

    await insertEvents(rows);
    return reply.code(204).send();
  });
}
