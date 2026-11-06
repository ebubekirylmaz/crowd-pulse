import os from "node:os";
import { io, type Socket } from "socket.io-client";

function arg(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value ?? fallback;
}

const baseUrl = arg("url", "http://localhost:3000").replace(/\/+$/, "");
const participantCount = Number(arg("participants", "200"));
const voteWindowMs = Number(arg("window", "3000"));
const connectConcurrency = Number(arg("concurrency", "50"));

const now = () => performance.now();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return Number.NaN;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))];
}

function summarize(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted.length > 0 ? sorted[sorted.length - 1] : Number.NaN,
  };
}

const fmt = (value: number) =>
  Number.isNaN(value) ? "n/a" : `${value.toFixed(1)} ms`;

async function runPool<T>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<void>,
) {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        await task(items[index], index);
      }
    },
  );
  await Promise.all(workers);
}

function connectSocket(auth: Record<string, string>) {
  return new Promise<Socket>((resolve, reject) => {
    const socket = io(baseUrl, {
      auth,
      reconnection: false,
      transports: ["websocket"],
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("connect timeout"));
    }, 15000);
    socket.on("room:joined", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on("connect_error", (error) => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });
  });
}

type VoteRecord = { emitAt: number; ackAt: number; ok: boolean };

async function main() {
  const demoResponse = await fetch(`${baseUrl}/demo`, { method: "POST" });
  if (!demoResponse.ok) {
    throw new Error(`could not create a demo room (${demoResponse.status})`);
  }
  const { token, code } = (await demoResponse.json()) as {
    token: string;
    code: string;
  };
  const active = (await (
    await fetch(`${baseUrl}/rooms/${code}/polls/active`)
  ).json()) as { options: { id: string }[] };
  const optionIds = active.options.map((option) => option.id);

  const sessions: string[] = new Array(participantCount).fill("");
  const joinStart = now();
  await runPool(sessions, 25, async (_, index) => {
    const response = await fetch(`${baseUrl}/rooms/${code}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: `load-${index}` }),
    });
    const body = (await response.json()) as { sessionToken: string };
    sessions[index] = body.sessionToken;
  });
  const joinMs = now() - joinStart;

  const host = await connectSocket({ token, roomCode: code });
  const firstSeen = new Map<number, number>();
  let hostTotal = 0;
  host.on("poll:results", (data: { options: { votes: number }[] }) => {
    const total = data.options.reduce((sum, option) => sum + option.votes, 0);
    const at = now();
    for (let k = hostTotal + 1; k <= total; k++) {
      if (!firstSeen.has(k)) firstSeen.set(k, at);
    }
    if (total > hostTotal) hostTotal = total;
  });

  const sockets: (Socket | null)[] = new Array(participantCount).fill(null);
  const connectTimes: number[] = [];
  let connectFailures = 0;
  await runPool(sessions, connectConcurrency, async (sessionToken, index) => {
    const start = now();
    try {
      sockets[index] = await connectSocket({ sessionToken });
      connectTimes.push(now() - start);
    } catch {
      connectFailures++;
    }
  });
  const connected = sockets.filter((socket): socket is Socket => socket !== null);

  const records: VoteRecord[] = [];
  await Promise.all(
    connected.map(async (socket, index) => {
      await sleep(Math.random() * voteWindowMs);
      const emitAt = now();
      const ack = await new Promise<{ ok: boolean }>((resolve) => {
        socket
          .timeout(15000)
          .emit(
            "vote:cast",
            { optionId: optionIds[index % optionIds.length] },
            (error: Error | null, response: { ok: boolean }) =>
              resolve(error ? { ok: false } : response),
          );
      });
      records.push({ emitAt, ackAt: now(), ok: ack.ok });
    }),
  );

  const accepted = records
    .filter((record) => record.ok)
    .sort((a, b) => a.ackAt - b.ackAt);
  const deadline = now() + 10000;
  while (hostTotal < accepted.length && now() < deadline) {
    await sleep(20);
  }

  const ackTimes = records.map((record) => record.ackAt - record.emitAt);
  const visibleTimes: number[] = [];
  accepted.forEach((record, index) => {
    const seen = firstSeen.get(index + 1);
    if (seen !== undefined) visibleTimes.push(Math.max(0, seen - record.emitAt));
  });
  const lastAck = accepted.length > 0 ? accepted[accepted.length - 1].ackAt : 0;
  const finalSeen = firstSeen.get(accepted.length);
  const settleMs = finalSeen === undefined ? Number.NaN : Math.max(0, finalSeen - lastAck);

  const finalPoll = (await (
    await fetch(`${baseUrl}/rooms/${code}/polls/active`)
  ).json()) as { options: { votes: number }[] };
  const storedTotal = finalPoll.options.reduce(
    (sum, option) => sum + option.votes,
    0,
  );

  const ack = summarize(ackTimes);
  const visible = summarize(visibleTimes);
  const connect = summarize(connectTimes);
  const cpus = os.cpus();

  console.log("\nCrowd Pulse load test");
  console.log(`target:               ${baseUrl}`);
  console.log(
    `machine:              ${cpus.length} cores (${cpus[0]?.model ?? "unknown"}), ${os.platform()} ${os.arch()}, Node ${process.version}`,
  );
  console.log(`participants:         ${participantCount} requested, ${connected.length} connected, ${connectFailures} failed`);
  console.log(`join over REST:       ${joinMs.toFixed(0)} ms for ${participantCount}`);
  console.log(`socket connect:       p50 ${fmt(connect.p50)}, p95 ${fmt(connect.p95)}, max ${fmt(connect.max)}`);
  console.log(`vote acknowledged:    p50 ${fmt(ack.p50)}, p95 ${fmt(ack.p95)}, p99 ${fmt(ack.p99)}, max ${fmt(ack.max)}`);
  console.log(`vote visible on host: p50 ${fmt(visible.p50)}, p95 ${fmt(visible.p95)}, p99 ${fmt(visible.p99)}, max ${fmt(visible.max)}`);
  console.log(`last vote settled:    ${fmt(settleMs)} after the last acknowledgement`);
  console.log(
    `consistency:          accepted ${accepted.length}, host saw ${hostTotal}, stored ${storedTotal} -> ${
      accepted.length === hostTotal && hostTotal === storedTotal ? "OK" : "MISMATCH"
    }`,
  );

  sockets.forEach((socket) => socket?.close());
  host.close();
  process.exit(
    accepted.length === hostTotal && hostTotal === storedTotal ? 0 : 1,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
