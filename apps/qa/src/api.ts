const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(API_URL + path, {
    ...init,
    headers: {
      // Gövdesiz isteğe bu başlık eklenirse sunucu 400 döner
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error ?? "request failed");
  }
  return response.json();
}

export type Room = { id: string; code: string; title: string };
export type JoinResponse = {
  sessionToken: string;
  participant: { id: string; displayName: string };
  room: Room;
};

export const api = {
  getRoom: (code: string) => request<Room>(`/rooms/${code}`),
  joinRoom: (code: string, displayName: string) =>
    request<JoinResponse>(`/rooms/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ displayName }),
    }),
};
