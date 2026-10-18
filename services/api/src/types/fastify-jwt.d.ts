import "@fastify/jwt";
import { FastifyRequest, FastifyReply } from "fastify";
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    io: import("socket.io").Server;
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}
