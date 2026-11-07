import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const code = readFileSync(new URL("../dist/cp.js", import.meta.url), "utf8");

const ENDPOINT = "https://api.example.com/collect";
const ROOM_REGEX = "^/(?:join|r)/([A-Za-z0-9]{4,12})";

function setup({
  attrs = { "data-endpoint": ENDPOINT, "data-room-regex": ROOM_REGEX },
  path = "/join/abc123",
  referrer = "",
  doNotTrack,
  beacon = "ok",
} = {}) {
  const beacons = [];
  const fetches = [];
  const pending = new Map();
  const listeners = { window: {}, document: {} };
  let nextId = 1;

  const location = { pathname: path, hostname: "app.example.com" };
  const history = { pushState() {}, replaceState() {} };
  const navigator = { doNotTrack };
  if (beacon !== "missing") {
    navigator.sendBeacon = (url, blob) => {
      beacons.push({ url, blob });
      return beacon === "ok";
    };
  }

  const on = (target) => (type, handler) => {
    (listeners[target][type] ||= []).push(handler);
  };

  const window = {
    navigator,
    location,
    history,
    setTimeout: (handler) => {
      const id = nextId++;
      pending.set(id, handler);
      return id;
    },
    clearTimeout: (id) => pending.delete(id),
    fetch: (url, options) => {
      fetches.push({ url, options });
      return Promise.resolve();
    },
    addEventListener: on("window"),
  };
  const document = {
    currentScript: { getAttribute: (name) => attrs[name] ?? null },
    referrer,
    visibilityState: "visible",
    addEventListener: on("document"),
  };

  new Function("window", "document", code)(window, document);

  return {
    window,
    document,
    beacons,
    fetches,
    pendingTimers: () => pending.size,
    navigate(nextPath) {
      location.pathname = nextPath;
      history.pushState();
    },
    fire(target, type) {
      (listeners[target][type] || []).forEach((handler) => handler());
    },
    runTimers() {
      const handlers = [...pending.values()];
      pending.clear();
      handlers.forEach((handler) => handler());
    },
    hide() {
      document.visibilityState = "hidden";
      (listeners.document.visibilitychange || []).forEach((handler) => handler());
    },
    async batches() {
      return Promise.all(
        beacons.map(async ({ blob }) => JSON.parse(await blob.text())),
      );
    },
  };
}

test("sends the first pageview when the page is hidden", async () => {
  const page = setup();
  assert.equal(page.beacons.length, 0);

  page.hide();

  assert.equal(page.beacons.length, 1);
  assert.equal(page.beacons[0].url, ENDPOINT);
  assert.equal(
    page.beacons[0].blob.type.toLowerCase(),
    "text/plain;charset=utf-8",
  );
  const [batch] = await page.batches();
  assert.equal(batch.events.length, 1);
  const [event] = batch.events;
  assert.equal(event.name, "pageview");
  assert.equal(event.path, "/join/abc123");
  assert.equal(event.room, "ABC123");
  assert.ok(Number.isInteger(event.age) && event.age >= 0);
  assert.equal(event.referrer, undefined);
});

test("flushes by itself after a short delay", async () => {
  const page = setup();
  assert.equal(page.pendingTimers(), 1);

  page.runTimers();

  assert.equal(page.beacons.length, 1);
  assert.equal(page.pendingTimers(), 0);
});

test("sends ten queued events as one request immediately", async () => {
  const page = setup();
  for (let i = 0; i < 9; i++) page.window.cp.track("vote");

  assert.equal(page.beacons.length, 1);
  const [batch] = await page.batches();
  assert.equal(batch.events.length, 10);
  assert.equal(page.pendingTimers(), 0);
});

test("follows client-side navigation and ignores repeated paths", async () => {
  const page = setup();
  page.navigate("/r/abc123");
  page.navigate("/r/abc123");
  page.navigate("/host/login");
  page.hide();

  const [batch] = await page.batches();
  assert.deepEqual(
    batch.events.map((event) => [event.name, event.path, event.room]),
    [
      ["pageview", "/join/abc123", "ABC123"],
      ["pageview", "/r/abc123", "ABC123"],
      ["pageview", "/host/login", undefined],
    ],
  );
});

test("falls back to fetch with keepalive when sendBeacon is missing", async () => {
  const page = setup({ beacon: "missing" });
  page.hide();

  assert.equal(page.fetches.length, 1);
  const { url, options } = page.fetches[0];
  assert.equal(url, ENDPOINT);
  assert.equal(options.method, "POST");
  assert.equal(options.keepalive, true);
  assert.equal(options.credentials, "omit");
  assert.equal(options.headers["content-type"], "text/plain;charset=UTF-8");
  assert.equal(JSON.parse(options.body).events.length, 1);
});

test("falls back to fetch when sendBeacon refuses the payload", () => {
  const page = setup({ beacon: "refuse" });
  page.hide();

  assert.equal(page.beacons.length, 1);
  assert.equal(page.fetches.length, 1);
});

test("does nothing when the browser asks not to be tracked", () => {
  const page = setup({ doNotTrack: "1" });
  page.hide();
  page.fire("window", "pagehide");

  assert.equal(page.window.cp, undefined);
  assert.equal(page.pendingTimers(), 0);
  assert.equal(page.beacons.length, 0);
  assert.equal(page.fetches.length, 0);
});

test("does nothing without a configured endpoint", () => {
  const page = setup({ attrs: {} });
  page.hide();

  assert.equal(page.window.cp, undefined);
  assert.equal(page.beacons.length, 0);
});

test("cleans event names and custom properties", async () => {
  const page = setup();
  page.window.cp.track("Vote Cast!", {
    option: "x".repeat(300),
    count: 3,
    anonymous: true,
    nested: { a: 1 },
    broken: Number.NaN,
    ["k".repeat(80)]: "long key",
    ...Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`extra${i}`, i])),
  });
  page.hide();

  const [batch] = await page.batches();
  const event = batch.events.find((item) => item.name !== "pageview");
  assert.equal(event.name, "vote_cast_");
  assert.equal(event.props.option.length, 100);
  assert.equal(event.props.count, 3);
  assert.equal(event.props.anonymous, true);
  assert.equal("nested" in event.props, false);
  assert.equal("broken" in event.props, false);
  assert.ok(Object.keys(event.props).length <= 10);
  assert.ok(Object.keys(event.props).every((key) => key.length <= 40));
});

test("drops empty names and invalid room codes instead of breaking the batch", async () => {
  const page = setup({
    attrs: { "data-endpoint": ENDPOINT, "data-room-regex": "^/join/([^/]+)" },
    path: "/join/x",
  });
  page.window.cp.track("");
  page.hide();

  const [batch] = await page.batches();
  assert.equal(batch.events.length, 1);
  assert.equal(batch.events[0].room, undefined);
});

test("records an external referrer once and ignores the site itself", async () => {
  const external = setup({ referrer: "https://www.linkedin.com/feed/" });
  external.navigate("/r/abc123");
  external.hide();
  const [batch] = await external.batches();
  assert.equal(batch.events[0].referrer, "www.linkedin.com");
  assert.equal(batch.events[1].referrer, undefined);

  const internal = setup({ referrer: "https://app.example.com/home" });
  internal.hide();
  const [internalBatch] = await internal.batches();
  assert.equal(internalBatch.events[0].referrer, undefined);
});

test("stays within the size budget and never touches cookies or storage", () => {
  const gzipped = gzipSync(code, { level: 9 }).length;
  assert.ok(gzipped < 2048, `gzipped size is ${gzipped} bytes`);
  assert.equal(/cookie|localStorage|sessionStorage|indexedDB/i.test(code), false);
});
