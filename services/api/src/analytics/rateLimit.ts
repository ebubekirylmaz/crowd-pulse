import { redis } from "../redis.js";

export async function withinCollectLimit(ip: string) {
  const limit = Number(process.env.COLLECT_LIMIT_PER_MINUTE) || 120;
  try {
    const key = `collect:${ip}:${Math.floor(Date.now() / 60_000)}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 90);
    return count <= limit;
  } catch {
    return true;
  }
}
