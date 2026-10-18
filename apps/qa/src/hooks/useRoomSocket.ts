import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  api,
  API_URL,
  ApiError,
  type ActivePoll,
  type PollOption,
  type Question,
} from "../api";

type Ack = { ok: boolean; error?: string };

function sortQuestions(list: Question[]) {
  return [...list].sort((a, b) => {
    if (a.upvotes === b.upvotes) {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return b.upvotes - a.upvotes;
  });
}

export function useRoomSocket(code: string, sessionToken: string) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [activePoll, setActivePoll] = useState<ActivePoll | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  const loadPoll = useCallback(async () => {
    try {
      setActivePoll(await api.getActivePoll(code));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setActivePoll(null);
      }
    }
  }, [code]);

  useEffect(() => {
    loadPoll();
    api
      .getQuestions(code)
      .then((list) => setQuestions(sortQuestions(list)))
      .catch(() => setQuestions([]));

    const socket = io(API_URL, { auth: { sessionToken } });
    socketRef.current = socket;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (error) => {
      if (error.message === "unauthorized") setUnauthorized(true);
    });
    socket.on("poll:activated", loadPoll);
    socket.on("poll:closed", () => setActivePoll(null));
    socket.on(
      "poll:results",
      (data: { pollId: string; options: PollOption[] }) =>
        setActivePoll((prev) =>
          prev && prev.poll.id === data.pollId
            ? { ...prev, options: data.options }
            : prev,
        ),
    );
    socket.on("question:new", (question: Question) =>
      setQuestions((prev) => sortQuestions([...prev, question])),
    );
    socket.on("question:updated", (question: Question) =>
      setQuestions((prev) =>
        sortQuestions(prev.map((q) => (q.id === question.id ? question : q))),
      ),
    );
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code, sessionToken, loadPoll]);

  const emit = (event: string, payload: unknown) =>
    new Promise<Ack>((resolve) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        resolve({ ok: false, error: "not_connected" });
        return;
      }
      socket
        .timeout(5000)
        .emit(event, payload, (err: Error | null, response: Ack) =>
          resolve(err ? { ok: false, error: "timeout" } : response),
        );
    });

  return {
    connected,
    unauthorized,
    activePoll,
    questions,
    vote: (optionId: string) => emit("vote:cast", { optionId }),
    ask: (body: string) => emit("question:ask", { body }),
    upvote: (questionId: string) => emit("question:upvote", { questionId }),
  };
}
