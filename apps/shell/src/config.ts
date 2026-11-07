function resolveApiUrl() {
  const configured = String(import.meta.env.VITE_API_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
  if (!configured) {
    return `${location.protocol}//${location.hostname}:3000`;
  }
  return /^https?:\/\//.test(configured) ? configured : `https://${configured}`;
}

export const API_URL = resolveApiUrl();
