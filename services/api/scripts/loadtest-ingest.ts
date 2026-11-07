import { randomInt } from "node:crypto";

function arg(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value ?? fallback;
}

const baseUrl = arg("url", "http://localhost:3000").replace(/\/+$/, "");
const durationMs = Number(arg("duration", "10")) * 1000;
const concurrency = Number(arg("concurrency", "64"));
const batchSize = Math.min(20, Number(arg("batch", "5")));
const room = arg("room", "").toUpperCase();
const limitProbe = Number(arg("limit-probe", "200"));

const EVENT_NAMES = ["pageview", "join", "vote", "question_ask", "question_upvote"];

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return Number.NaN;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))];
}

const fmt = (value: number) =>
  Number.isNaN(value) ? "n/a" : `${value.toFixed(1)} ms`;

function randomIp() {
  return `10.${randomInt(0, 256)}.${randomInt(0, 256)}.${randomInt(1, 255)}`;
}

function body(size: number) {
  const events = Array.from({ length: size }, () => {
    const name = EVENT_NAMES[randomInt(0, EVENT_NAMES.length)];
    return {
      name,
      path: room ? `/r/${room}` : "/",
      ...(room ? { room } : {}),
      props: name === "vote" ? { option: "A", anonymous: false } : {},
    };
  });
  return JSON.stringify({ events });
}

function send(ip: string, size: number) {
  return fetch(`${baseUrl}/collect`, {
    method: "POST",
    headers: {
      "content-type": "text/plain;charset=UTF-8",
      "user-agent": "Mozilla/5.0 LoadTest",
      "x-forwarded-for": ip,
    },
    body: body(size),
  });
}

async function throughput() {
  const latencies: number[] = [];
  const statuses = new Map<number, number>();
  let acceptedEvents = 0;
  const startedAt = performance.now();
  const deadline = startedAt + durationMs;

  const workers = Array.from({ length: concurrency }, async () => {
    while (performance.now() < deadline) {
      const begin = performance.now();
      try {
        const res = await send(randomIp(), batchSize);
        await res.arrayBuffer();
        latencies.push(performance.now() - begin);
        statuses.set(res.status, (statuses.get(res.status) ?? 0) + 1);
        if (res.status === 204) acceptedEvents += batchSize;
      } catch {
        statuses.set(0, (statuses.get(0) ?? 0) + 1);
      }
    }
  });
  await Promise.all(workers);

  const elapsed = (performance.now() - startedAt) / 1000;
  const sorted = [...latencies].sort((a, b) => a - b);
  const requests = latencies.length;
  console.log(`\nthroughput: ${concurrency} workers, ${batchSize} events per request, ${(durationMs / 1000).toFixed(0)} s`);
  console.log(`  requests: ${requests} (${Math.round(requests / elapsed)} per second)`);
  console.log(`  events accepted: ${acceptedEvents} (${Math.round(acceptedEvents / elapsed)} per second)`);
  console.log(`  status codes: ${[...statuses].map(([code, n]) => `${code}=${n}`).join(", ")}`);
  console.log(`  request latency p50 ${fmt(percentile(sorted, 50))}, p95 ${fmt(percentile(sorted, 95))}, p99 ${fmt(percentile(sorted, 99))}, max ${fmt(sorted[sorted.length - 1])}`);
}

async function rateLimitProbe() {
  const ip = randomIp();
  const statuses = new Map<number, number>();
  for (let i = 0; i < limitProbe; i++) {
    const res = await send(ip, 1);
    await res.arrayBuffer();
    statuses.set(res.status, (statuses.get(res.status) ?? 0) + 1);
  }
  const accepted = statuses.get(204) ?? 0;
  const limited = statuses.get(429) ?? 0;
  console.log(`\nrate limit: one ip sent ${limitProbe} requests in a row`);
  console.log(`  accepted ${accepted}, rejected with 429: ${limited}`);
}

await throughput();
await rateLimitProbe();
