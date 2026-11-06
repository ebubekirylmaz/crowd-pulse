import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { deleteExpiredDemoHosts } from "../src/db/demoCleanup.js";
import { sql } from "../src/db/index.js";
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

describe("demo", () => {
  it("creates a throwaway host with a ready room", async () => {
    const res = await app.inject({ method: "POST", url: "/demo" });
    expect(res.statusCode).toBe(201);
    const { token, code } = res.json();

    const rooms = await app.inject({
      method: "GET",
      url: "/rooms",
      headers: bearer(token),
    });
    expect(rooms.json().map((r: { code: string }) => r.code)).toContain(code);

    const active = await app.inject({
      method: "GET",
      url: `/rooms/${code}/polls/active`,
    });
    expect(active.statusCode).toBe(200);
    expect(active.json().options).toHaveLength(3);

    const questions = await app.inject({
      method: "GET",
      url: `/rooms/${code}/questions`,
    });
    expect(questions.json()).toHaveLength(2);
  });

  it("removes expired demo hosts and keeps real ones", async () => {
    await app.inject({ method: "POST", url: "/demo" });
    await registerHost(app, "real@example.com");
    await sql`update hosts set created_at = now() - interval '2 days'`;

    await deleteExpiredDemoHosts();

    const remaining = await sql`select email, is_demo from hosts`;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].email).toBe("real@example.com");
    expect(remaining[0].is_demo).toBe(false);
  });
});
