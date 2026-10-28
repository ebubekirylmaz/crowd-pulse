import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  api,
  API_URL,
  ApiError,
  type HostPoll,
  type PollOption,
  type Question,
} from "../api";
import { sortQuestions } from "../lib/sortQuestions";

export function useHostRoom(code: string, token: string) {
  const [connected, setConnected] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [polls, setPolls] = useState<HostPoll[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  const loadPolls = useCallback(async () => {
    try {
      setPolls(await api.listPolls(token, code));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUnauthorized(true);
      } else if (error instanceof ApiError && error.status === 404) {
        setNotFound(true);
      }
    }
  }, [code, token]);

  useEffect(() => {
    let cancelled = false;
    loadPolls().finally(() => {
      if (!cancelled) setLoading(false);
    });
    api
      .getQuestions(code)
      .then((list) => {
        if (!cancelled) setQuestions(sortQuestions(list));
      })
      .catch(() => {
        if (!cancelled) setQuestions([]);
      });

    const socket = io(API_URL, { auth: { token, roomCode: code } });
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (error) => {
      if (error.message === "unauthorized") setUnauthorized(true);
    });
    socket.on("poll:activated", loadPolls);
    socket.on("poll:closed", loadPolls);
    socket.on(
      "poll:results",
      (data: { pollId: string; options: PollOption[] }) =>
        setPolls((prev) =>
          prev.map((poll) =>
            poll.id === data.pollId ? { ...poll, options: data.options } : poll,
          ),
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
      cancelled = true;
      socket.disconnect();
    };
  }, [code, token, loadPolls]);

  return {
    connected,
    unauthorized,
    notFound,
    loading,
    polls,
    questions,
    reloadPolls: loadPolls,
  };
}
