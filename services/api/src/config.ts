const LOCAL_NETWORK_ORIGIN =
  /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

function parseCorsOrigin(value: string | undefined): string | RegExp | string[] {
  const origins = (value ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  if (origins.length === 0) return LOCAL_NETWORK_ORIGIN;
  return origins.length === 1 ? origins[0] : origins;
}

export const corsOrigin = parseCorsOrigin(process.env.CORS_ORIGIN);
