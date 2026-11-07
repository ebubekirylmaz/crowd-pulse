import type { Overview, Range, RoomReport } from "./analytics/types";

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

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, token: string): Promise<T> {
  const response = await fetch(API_URL + path, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error ?? "request failed");
  }
  return response.json();
}

export const api = {
  getAnalyticsOverview: (token: string, range: Range) =>
    request<Overview>(`/analytics/overview?range=${range}`, token),
  getRoomAnalytics: (token: string, code: string, range: Range) =>
    request<RoomReport>(`/analytics/rooms/${code}?range=${range}`, token),
};
