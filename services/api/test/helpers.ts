import type { FastifyInstance } from "fastify";
import { io, type Socket } from "socket.io-client";
import { sql } from "../src/db/index.js";

export async function resetDb() {
  const [{ current_database: name }] = await sql`select current_database()`;
  if (!String(name).endsWith("_test")) {
    throw new Error(`refusing to reset database "${name}"`);
  }
  await sql`truncate hosts restart identity cascade`;
}

const PASSWORD = "password123";

export async function registerHost(app: FastifyInstance, email: string) {
  await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, password: PASSWORD },
  });
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password: PASSWORD },
  });
  return res.json().token as string;
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

export async function createRoom(app: FastifyInstance, token: string) {
  const res = await app.inject({
    method: "POST",
    url: "/rooms",
    headers: bearer(token),
    payload: { title: "Test room" },
  });
  return res.json() as { id: string; code: string; title: string };
}

export async function createPoll(
  app: FastifyInstance,
  token: string,
  code: string,
) {
  const res = await app.inject({
    method: "POST",
    url: `/rooms/${code}/polls`,
    headers: bearer(token),
    payload: { question: "Favorite?", options: ["A", "B"] },
  });
  return res.json() as {
    poll: { id: string };
    options: { id: string; label: string }[];
  };
}

export async function activatePoll(
  app: FastifyInstance,
  token: string,
  pollId: string,
) {
  return app.inject({
    method: "POST",
    url: `/polls/${pollId}/activate`,
    headers: bearer(token),
  });
}

export async function joinRoom(
  app: FastifyInstance,
  code: string,
  displayName: string,
) {
  const res = await app.inject({
    method: "POST",
    url: `/rooms/${code}/join`,
    payload: { displayName },
  });
  return res.json() as { sessionToken: string };
}

export function connectSocket(url: string, auth: Record<string, string>) {
  return new Promise<Socket>((resolve, reject) => {
    const socket = io(url, { auth, reconnection: false });
    socket.on("room:joined", () => resolve(socket));
    socket.on("connect_error", (error) => {
      socket.close();
      reject(error);
    });
  });
}

export function emitWithAck<T = { ok: boolean; error?: string }>(
  socket: Socket,
  event: string,
  payload: unknown,
) {
  return new Promise<T>((resolve) => {
    socket.emit(event, payload, resolve);
  });
}

export function waitForEvent<T>(socket: Socket, event: string) {
  return new Promise<T>((resolve) => {
    socket.once(event, resolve);
  });
}
