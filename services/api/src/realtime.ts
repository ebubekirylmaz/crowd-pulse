import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import { sql } from "./db/index.js";

export function setupRealtime(app: FastifyInstance) {
  const io = new Server(app.server, { cors: { origin: "*" } });

  io.use(async (socket, next) => {
    try {
      const { sessionToken, token, roomCode } = socket.handshake.auth;

      if (sessionToken) {
        const [participant] =
          await sql`select id, room_id from participants where session_token = ${sessionToken}`;
        if (participant) {
          socket.data = {
            role: "participant",
            roomId: participant.room_id,
            participantId: participant.id,
          };
          return next();
        }
      } else if (token && roomCode) {
        const payload = app.jwt.verify<{ sub: string }>(token);
        const [room] =
          await sql`select id from rooms where code = ${String(roomCode).toUpperCase()} and host_id = ${payload.sub}`;
        if (room) {
          socket.data = {
            role: "host",
            roomId: room.id,
            hostId: payload.sub,
          };
          return next();
        }
      }

      next(new Error("unauthorized"));
    } catch (error) {
      app.log.warn({ err: error }, "socket auth failed");
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`room:${socket.data.roomId}`);
    socket.emit("room:joined", { role: socket.data.role });
  });

  app.addHook("onClose", async () => {
    io.close();
  });

  return io;
}
