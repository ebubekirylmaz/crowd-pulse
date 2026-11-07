import { createHmac } from "node:crypto";

const secret = createHmac(
  "sha256",
  process.env.ANALYTICS_SECRET ?? process.env.JWT_SECRET ?? "",
)
  .update("analytics-v1")
  .digest();

export function dailySalt(date = new Date()) {
  return createHmac("sha256", secret)
    .update(date.toISOString().slice(0, 10))
    .digest();
}

export function visitorHash(ip: string, userAgent: string, date = new Date()) {
  return createHmac("sha256", dailySalt(date))
    .update(`${ip}|${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}
