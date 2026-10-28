import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Socket } from "socket.io-client";
import { buildApp } from "../src/app.js";
import {
  activatePoll,
  connectSocket,
  createPoll,
  createRoom,
  emitWithAck,
  joinRoom,
  registerHost,
  resetDb,
  waitForEvent,
} from "./helpers.js";

const app = buildApp();
let url = "";
let sockets: Socket[] = [];

async function connect(auth: Record<string, string>) {
  const socket = await connectSocket(url, auth);
  sockets.push(socket);
  return socket;
}

beforeAll(async () => {
  await app.listen({ port: 0, host: "127.0.0.1" });
  url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});
afterAll(() => app.close());
beforeEach(() => resetDb());
afterEach(() => {
  sockets.forEach((socket) => socket.close());
  sockets = [];
});

describe("socket auth", () => {
  it("rejects an unknown session token", async () => {
    await expect(connectSocket(url, { sessionToken: "nope" })).rejects.toThrow(
      "unauthorized",
    );
  });

  it("rejects a host connecting to a room they do not own", async () => {
    const owner = await registerHost(app, "owner@example.com");
    const other = await registerHost(app, "other@example.com");
    const room = await createRoom(app, owner);
    await expect(
      connectSocket(url, { token: other, roomCode: room.code }),
    ).rejects.toThrow("unauthorized");
  });
});

describe("voting", () => {
  it("accepts one vote per participant and broadcasts the results", async () => {
    const token = await registerHost(app, "host@example.com");
    const room = await createRoom(app, token);
    const { poll, options } = await createPoll(app, token, room.code);
    await activatePoll(app, token, poll.id);
    const { sessionToken } = await joinRoom(app, room.code, "Ali");

    const host = await connect({ token, roomCode: room.code });
    const participant = await connect({ sessionToken });

    const results = waitForEvent<{
      options: { id: string; votes: number }[];
    }>(host, "poll:results");
    const first = await emitWithAck(participant, "vote:cast", {
      optionId: options[0].id,
    });
    const second = await emitWithAck(participant, "vote:cast", {
      optionId: options[1].id,
    });

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: false, error: "already_voted" });
    const broadcast = await results;
    expect(broadcast.options.find((o) => o.id === options[0].id)?.votes).toBe(
      1,
    );
  });
});

describe("questions", () => {
  it("lets only participants of the same room ask and upvote", async () => {
    const token = await registerHost(app, "host@example.com");
    const roomA = await createRoom(app, token);
    const roomB = await createRoom(app, token);
    const ali = await joinRoom(app, roomA.code, "Ali");
    const outsider = await joinRoom(app, roomB.code, "Veli");

    const host = await connect({ token, roomCode: roomA.code });
    const aliSocket = await connect({ sessionToken: ali.sessionToken });
    const outsiderSocket = await connect({ sessionToken: outsider.sessionToken });

    const asked = await emitWithAck<{
      ok: boolean;
      question: { id: string };
    }>(aliSocket, "question:ask", { body: "Why?" });
    const hostAsk = await emitWithAck(host, "question:ask", { body: "x" });
    const crossRoom = await emitWithAck(outsiderSocket, "question:upvote", {
      questionId: asked.question.id,
    });
    const own = await emitWithAck(aliSocket, "question:upvote", {
      questionId: asked.question.id,
    });
    const again = await emitWithAck(aliSocket, "question:upvote", {
      questionId: asked.question.id,
    });

    expect(asked.ok).toBe(true);
    expect(hostAsk).toEqual({ ok: false, error: "forbidden" });
    expect(crossRoom).toEqual({ ok: false, error: "question_not_found" });
    expect(own.ok).toBe(true);
    expect(again).toEqual({ ok: false, error: "already_upvoted" });
  });
});
