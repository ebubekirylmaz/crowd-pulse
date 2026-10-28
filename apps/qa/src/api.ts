export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

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

export type PollOption = {
  id: string;
  label: string;
  position: number;
  votes: number;
};
export type ActivePoll = {
  poll: { id: string; question: string };
  options: PollOption[];
};
export type Question = {
  id: string;
  body: string;
  displayName: string;
  createdAt: string;
  upvotes: number;
};

export type HostRoom = Room & { createdAt: string };

export type PollStatus = "draft" | "active" | "closed";
export type HostPoll = {
  id: string;
  question: string;
  status: PollStatus;
  createdAt: string;
  options: PollOption[];
};

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

export const api = {
  getRoom: (code: string) => request<Room>(`/rooms/${code}`),
  joinRoom: (code: string, displayName: string) =>
    request<JoinResponse>(`/rooms/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ displayName }),
    }),
  getActivePoll: (code: string) =>
    request<ActivePoll>(`/rooms/${code}/polls/active`),
  getQuestions: (code: string) =>
    request<Question[]>(`/rooms/${code}/questions`),
  login: (email: string, password: string) =>
    request<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string) =>
    request<{ id: string; email: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  listRooms: (token: string) =>
    request<HostRoom[]>("/rooms", {
      headers: { authorization: `Bearer ${token}` },
    }),
  createRoom: (token: string, title: string) =>
    request<HostRoom>("/rooms", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ title }),
    }),
  listPolls: (token: string, code: string) =>
    request<HostPoll[]>(`/rooms/${code}/polls`, { headers: bearer(token) }),
  createPoll: (
    token: string,
    code: string,
    question: string,
    options: string[],
  ) =>
    request<unknown>(`/rooms/${code}/polls`, {
      method: "POST",
      headers: bearer(token),
      body: JSON.stringify({ question, options }),
    }),
  activatePoll: (token: string, pollId: string) =>
    request<unknown>(`/polls/${pollId}/activate`, {
      method: "POST",
      headers: bearer(token),
    }),
  closePoll: (token: string, pollId: string) =>
    request<unknown>(`/polls/${pollId}/close`, {
      method: "POST",
      headers: bearer(token),
    }),
};
