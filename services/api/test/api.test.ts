import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import {
  activatePoll,
  bearer,
  createPoll,
  createRoom,
  registerHost,
  resetDb,
} from "./helpers.js";

const app = buildApp();

beforeAll(() => app.ready());
afterAll(() => app.close());
beforeEach(() => resetDb());

describe("auth", () => {
  it("rejects a duplicate registration", async () => {
    const payload = { email: "a@example.com", password: "password123" };
    const first = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload,
    });
    const second = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload,
    });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(409);
  });

  it("requires a token for /auth/me", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(401);
  });
});

describe("poll ownership", () => {
  it("hides another host's room and polls", async () => {
    const owner = await registerHost(app, "owner@example.com");
    const other = await registerHost(app, "other@example.com");
    const room = await createRoom(app, owner);
    const { poll } = await createPoll(app, owner, room.code);

    const list = await app.inject({
      method: "GET",
      url: `/rooms/${room.code}/polls`,
      headers: bearer(other),
    });
    const activate = await activatePoll(app, other, poll.id);

    expect(list.statusCode).toBe(404);
    expect(activate.statusCode).toBe(404);
  });
});

describe("active poll", () => {
  it("closes the previous active poll when another is activated", async () => {
    const token = await registerHost(app, "host@example.com");
    const room = await createRoom(app, token);
    const first = await createPoll(app, token, room.code);
    const second = await createPoll(app, token, room.code);

    await activatePoll(app, token, first.poll.id);
    await activatePoll(app, token, second.poll.id);

    const res = await app.inject({
      method: "GET",
      url: `/rooms/${room.code}/polls`,
      headers: bearer(token),
    });
    const statuses = Object.fromEntries(
      res.json().map((p: { id: string; status: string }) => [p.id, p.status]),
    );
    expect(statuses[first.poll.id]).toBe("closed");
    expect(statuses[second.poll.id]).toBe("active");
  });
});
