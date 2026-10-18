import { type FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { api, type Room as RoomInfo } from "../api";
import { clearSession, loadSession } from "../session";
import { useRoomSocket } from "../hooks/useRoomSocket";

export default function Room() {
  const { code } = useParams();
  if (!code) {
    return <Navigate to="/" replace />;
  }
  const session = loadSession(code);
  if (!session) {
    return <Navigate to={`/join/${code}`} replace />;
  }
  return <RoomView code={code} sessionToken={session.sessionToken} />;
}

function RoomView({
  code,
  sessionToken,
}: {
  code: string;
  sessionToken: string;
}) {
  const navigate = useNavigate();
  const { connected, unauthorized, activePoll, questions, vote, ask, upvote } =
    useRoomSocket(code, sessionToken);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [votedPollId, setVotedPollId] = useState<string | null>(null);
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .getRoom(code)
      .then(setRoom)
      .catch(() => setRoom(null));
  }, [code]);

  useEffect(() => {
    if (unauthorized) {
      clearSession(code);
      navigate(`/join/${code}`, { replace: true });
    }
  }, [unauthorized, code, navigate]);

  if (unauthorized) return null;

  async function handleVote(optionId: string) {
    if (!activePoll) return;
    const pollId = activePoll.poll.id;
    const result = await vote(optionId);
    if (result.ok || result.error === "already_voted") {
      setVotedPollId(pollId);
      setMessage(null);
    } else {
      setMessage("Oy verilemedi, tekrar dene");
    }
  }

  async function handleAsk(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setAsking(true);
    const result = await ask(body);
    setAsking(false);
    if (result.ok) {
      setDraft("");
      setMessage(null);
    } else {
      setMessage("Soru gönderilemedi, tekrar dene");
    }
  }

  async function handleUpvote(questionId: string) {
    const result = await upvote(questionId);
    if (result.ok || result.error === "already_upvoted") {
      setUpvoted((prev) => new Set(prev).add(questionId));
    }
  }

  const hasVoted = activePoll !== null && votedPollId === activePoll.poll.id;
  const totalVotes =
    activePoll?.options.reduce((sum, option) => sum + option.votes, 0) ?? 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{room?.title ?? "Oda"}</h1>
        <span
          className={`h-3 w-3 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
          title={connected ? "Bağlı" : "Bağlantı yok"}
        />
      </header>

      {message && <p className="text-sm text-red-600">{message}</p>}

      <section className="rounded-lg border border-slate-200 p-4">
        {activePoll ? (
          <>
            <h2 className="mb-3 text-lg font-semibold">
              {activePoll.poll.question}
            </h2>
            <ul className="flex flex-col gap-2">
              {activePoll.options.map((option) => {
                const percent =
                  totalVotes > 0
                    ? Math.round((option.votes / totalVotes) * 100)
                    : 0;
                return (
                  <li key={option.id}>
                    <button
                      onClick={() => handleVote(option.id)}
                      disabled={hasVoted}
                      className="relative w-full overflow-hidden rounded-lg border border-slate-300 px-3 py-3 text-left disabled:cursor-default"
                    >
                      <span
                        className="absolute inset-y-0 left-0 bg-slate-200 transition-all"
                        style={{ width: `${percent}%` }}
                      />
                      <span className="relative flex justify-between">
                        <span>{option.label}</span>
                        <span className="text-sm text-slate-600">
                          {option.votes} · %{percent}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {hasVoted && (
              <p className="mt-2 text-sm text-slate-600">Oy verdin</p>
            )}
          </>
        ) : (
          <p className="text-slate-600">Şu an aktif anket yok</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Sorular</h2>
        <form onSubmit={handleAsk} className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Bir soru sor"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
          <button
            type="submit"
            disabled={asking || draft.trim() === ""}
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-base font-semibold text-white disabled:opacity-50"
          >
            Gönder
          </button>
        </form>

        {questions.length === 0 ? (
          <p className="text-slate-600">Henüz soru yok</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {questions.map((question) => (
              <li
                key={question.id}
                className="flex items-start gap-3 rounded-lg border border-slate-200 p-3"
              >
                <button
                  onClick={() => handleUpvote(question.id)}
                  disabled={upvoted.has(question.id)}
                  className="flex min-w-10 flex-col items-center rounded-lg border border-slate-300 px-2 py-1 disabled:bg-slate-100"
                  aria-label="Destekle"
                >
                  <span>▲</span>
                  <span className="text-sm">{question.upvotes}</span>
                </button>
                <div>
                  <p className="break-words">{question.body}</p>
                  <p className="text-xs text-slate-500">
                    {question.displayName}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
