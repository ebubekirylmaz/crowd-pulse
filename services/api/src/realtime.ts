import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import { getPollResults } from "./db/pollResults.js";
import { sql } from "./db/index.js";
import { z } from "zod";

const voteCastSchema = z.object({
  optionId: z.string().uuid(),
});

export function setupRealtime(app: FastifyInstance) {
  const io = new Server(app.server, { cors: { origin: "*" } });

  app.decorate("io", io);

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

    socket.on("vote:cast", async (payload, ack) => {
      if (typeof ack !== "function") {
        return;
      }
      try {
        if (socket.data.role !== "participant") {
          return ack({ ok: false, error: "forbidden" });
        }
        const { success, data: parsedData } = voteCastSchema.safeParse(payload);
        if (!success) {
          return ack({ ok: false, error: "invalid_input" });
        }
        const [poll] =
          await sql`select id from polls where room_id = ${socket.data.roomId} and status = 'active'`;
        if (!poll) {
          return ack({ ok: false, error: "poll_not_active" });
        }
        const [option] =
          await sql`select id from poll_options where poll_id = ${poll.id} and id = ${parsedData.optionId}`;
        if (!option) {
          return ack({ ok: false, error: "invalid_option" });
        }
        try {
          await sql`insert into votes (poll_id, option_id, participant_id) values (${poll.id}, ${option.id}, ${socket.data.participantId})`;
        } catch (error) {
          if ((error as { code?: string }).code === "23505") {
            return ack({ ok: false, error: "already_voted" });
          }
          throw error;
        }
        const options = await getPollResults(poll.id);
        io.to(`room:${socket.data.roomId}`).emit("poll:results", {
          pollId: poll.id,
          options,
        });
        ack({ ok: true });
      } catch (error) {
        app.log.error(error);
        ack({ ok: false, error: "server_error" });
      }
    });
  });

  app.addHook("onClose", async () => {
    io.close();
  });

  return io;
}
