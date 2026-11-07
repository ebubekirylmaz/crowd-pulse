import { afterEach, describe, expect, it, vi } from "vitest";
import { connectAnalytics, emit, on, onAny, toAnalytics } from "../src/index.ts";

type TrackScope = typeof globalThis & { cp?: { track: ReturnType<typeof vi.fn> } };

afterEach(() => {
  delete (globalThis as TrackScope).cp;
});

describe("event bus", () => {
  it("delivers a typed event to subscribers of that name only", () => {
    const voted = vi.fn();
    const asked = vi.fn();
    const stopVoted = on("poll:voted", voted);
    const stopAsked = on("question:asked", asked);

    emit("question:asked", { anonymous: true });

    expect(asked).toHaveBeenCalledWith({ anonymous: true });
    expect(voted).not.toHaveBeenCalled();
    stopVoted();
    stopAsked();
  });

  it("stops delivering after unsubscribe", () => {
    const handler = vi.fn();
    const stop = on("room:joined", handler);
    emit("room:joined", {});
    stop();
    emit("room:joined", {});
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("lets a listener see every event with its name", () => {
    const seen: string[] = [];
    const stop = onAny((event) => seen.push(event.name));
    emit("poll:created", { options: 3 });
    emit("poll:voted", {});
    stop();
    expect(seen).toEqual(["poll:created", "poll:voted"]);
  });
});

describe("analytics bridge", () => {
  it("maps domain events to the names the dashboard already uses", () => {
    expect(toAnalytics({ name: "poll:voted", detail: {} })).toEqual({
      name: "vote",
      props: undefined,
    });
    expect(
      toAnalytics({ name: "question:asked", detail: { anonymous: false } }),
    ).toEqual({ name: "question_ask", props: { anonymous: false } });
    expect(
      toAnalytics({ name: "poll:created", detail: { options: 4 } }),
    ).toEqual({ name: "poll_create", props: { options: 4 } });
  });

  it("forwards events to the snippet once, even if connected twice", () => {
    const track = vi.fn();
    (globalThis as TrackScope).cp = { track };
    const disconnect = connectAnalytics();
    connectAnalytics();

    emit("poll:voted", {});

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("vote", undefined);
    disconnect();
    emit("poll:voted", {});
    expect(track).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the snippet is not loaded", () => {
    const disconnect = connectAnalytics();
    expect(() => emit("room:joined", {})).not.toThrow();
    disconnect();
  });
});
