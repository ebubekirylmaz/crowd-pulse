import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
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

const appA = buildApp();
const appB = buildApp();
let urlA = "";
let urlB = "";
let sockets: Socket[] = [];

async function connect(url: string, auth: Record<string, string>) {
  const socket = await connectSocket(url, auth);
  sockets.push(socket);
  return socket;
}

const addressOf = (app: typeof appA) =>
  `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;

beforeAll(async () => {
  await appA.listen({ port: 0, host: "127.0.0.1" });
  await appB.listen({ port: 0, host: "127.0.0.1" });
  urlA = addressOf(appA);
  urlB = addressOf(appB);
});
afterAll(async () => {
  await appA.close();
  await appB.close();
});
beforeEach(() => resetDb());
afterEach(() => {
  sockets.forEach((socket) => socket.close());
  sockets = [];
});

describe("multiple server instances", () => {
  it("delivers a vote cast on one instance to a host on another", async () => {
    const token = await registerHost(appA, "host@example.com");
    const room = await createRoom(appA, token);
    const { poll, options } = await createPoll(appA, token, room.code);
    await activatePoll(appA, token, poll.id);
    const { sessionToken } = await joinRoom(appA, room.code, "Ali");

    const host = await connect(urlA, { token, roomCode: room.code });
    const participant = await connect(urlB, { sessionToken });

    const results = waitForEvent<{
      options: { id: string; votes: number }[];
    }>(host, "poll:results");
    const ack = await emitWithAck(participant, "vote:cast", {
      optionId: options[0].id,
    });

    expect(ack).toEqual({ ok: true });
    const broadcast = await results;
    expect(broadcast.options.find((o) => o.id === options[0].id)?.votes).toBe(
      1,
    );
  });

  it("delivers a host action made on one instance to participants on another", async () => {
    const token = await registerHost(appA, "host@example.com");
    const room = await createRoom(appA, token);
    const { poll } = await createPoll(appA, token, room.code);
    const { sessionToken } = await joinRoom(appA, room.code, "Ali");

    const participant = await connect(urlB, { sessionToken });
    const activated = waitForEvent<{ poll: { id: string; status: string } }>(
      participant,
      "poll:activated",
    );
    await activatePoll(appA, token, poll.id);

    const event = await activated;
    expect(event.poll.id).toBe(poll.id);
    expect(event.poll.status).toBe("active");
  });
});
