import { type FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { api, type Room as RoomInfo } from "../api";
import { clearSession, loadSession } from "../session";
import { usePageTitle } from "../hooks/usePageTitle";
import { useRoomSocket } from "../hooks/useRoomSocket";
import {
  loadUpvotes,
  loadVote,
  saveUpvotes,
  saveVote,
} from "../lib/choices";
import { percentOf, pluralize, timeAgo } from "../lib/format";
import { orderQuestions, type QuestionOrder } from "../lib/sortQuestions";
import {
  Alert,
  Badge,
  Button,
  Card,
  cx,
  EmptyState,
  LiveIndicator,
  Logo,
  Skeleton,
  TextArea,
  TopBar,
} from "../components/ui";
import { CheckIcon, ChevronUpIcon, MessageIcon, PulseIcon } from "../components/icons";

const MAX_QUESTION_LENGTH = 300;

const ORDERS: { value: QuestionOrder; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "newest", label: "Newest" },
];

export default function Room() {
  const { code } = useParams();
  if (!code) {
    return <Navigate to="/" replace />;
  }
  const session = loadSession(code);
  if (!session) {
    return <Navigate to={`/join/${code}`} replace />;
  }
  return (
    <RoomView
      code={code}
      sessionToken={session.sessionToken}
      displayName={session.displayName}
    />
  );
}

function RoomView({
  code,
  sessionToken,
  displayName,
}: {
  code: string;
  sessionToken: string;
  displayName: string;
}) {
  const navigate = useNavigate();
  const {
    connected,
    reconnecting,
    loading,
    unauthorized,
    activePoll,
    questions,
    vote,
    ask,
    upvote,
  } = useRoomSocket(code, sessionToken);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [upvoted, setUpvoted] = useState<Set<string>>(
    () => new Set(loadUpvotes(code)),
  );
  const [draft, setDraft] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [order, setOrder] = useState<QuestionOrder>("top");
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  usePageTitle(room?.title);

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

  const pollId = activePoll?.poll.id ?? null;
  const myVote = pollId ? (votes[pollId] ?? loadVote(pollId)) : null;
  const hasVoted = myVote !== null;
  const totalVotes =
    activePoll?.options.reduce((sum, option) => sum + option.votes, 0) ?? 0;

  async function handleVote(optionId: string) {
    if (!pollId) return;
    const result = await vote(optionId);
    if (result.ok) {
      setVotes((prev) => ({ ...prev, [pollId]: optionId }));
      saveVote(pollId, optionId);
      setMessage(null);
    } else if (result.error === "already_voted") {
      setVotes((prev) => ({ ...prev, [pollId]: "" }));
      saveVote(pollId, "");
      setMessage(null);
    } else {
      setMessage("Couldn't submit your vote, try again");
    }
  }

  async function handleAsk(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setAsking(true);
    const result = await ask(body, anonymous);
    setAsking(false);
    if (result.ok) {
      setDraft("");
      setMessage(null);
    } else {
      setMessage("Couldn't send your question, try again");
    }
  }

  async function handleUpvote(questionId: string) {
    const result = await upvote(questionId);
    if (result.ok || result.error === "already_upvoted") {
      setUpvoted((prev) => {
        const next = new Set(prev).add(questionId);
        saveUpvotes(code, [...next]);
        return next;
      });
    }
  }

  return (
    <div className="min-h-dvh">
      <TopBar
        left={<Logo />}
        right={<LiveIndicator connected={connected} />}
      />
      <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {room?.title ?? "Room"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Joined as {displayName}
          </p>
        </div>

        {reconnecting && (
          <Alert tone="info">Connection lost. Reconnecting...</Alert>
        )}
        {message && <Alert>{message}</Alert>}

        <section aria-labelledby="poll-heading">
          <Card>
            {loading ? (
              <PollSkeleton />
            ) : activePoll ? (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="flex flex-col gap-2">
                  <div>
                    <Badge tone="brand">Live poll</Badge>
                  </div>
                  <h2
                    id="poll-heading"
                    className="text-xl font-semibold tracking-tight"
                  >
                    {activePoll.poll.question}
                  </h2>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {activePoll.options.map((option) => {
                    const percent = percentOf(option.votes, totalVotes);
                    const selected = myVote === option.id;
                    return (
                      <li key={option.id}>
                        <button
                          onClick={() => handleVote(option.id)}
                          disabled={hasVoted}
                          className={cx(
                            "relative w-full overflow-hidden rounded-xl border px-4 py-3.5 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30",
                            selected
                              ? "border-brand-500 ring-2 ring-brand-500/30"
                              : "border-slate-200 dark:border-slate-700",
                            hasVoted
                              ? "cursor-default"
                              : "hover:border-brand-400 hover:bg-brand-50 active:scale-[0.99] dark:hover:bg-slate-800",
                          )}
                        >
                          <span
                            className={cx(
                              "absolute inset-y-0 left-0 transition-[width] duration-500 ease-out",
                              selected
                                ? "bg-brand-200/80 dark:bg-brand-900/60"
                                : "bg-slate-100 dark:bg-slate-800",
                            )}
                            style={{ width: `${percent}%` }}
                          />
                          <span className="relative flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 font-medium">
                              {selected && (
                                <CheckIcon className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                              )}
                              {option.label}
                            </span>
                            <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {percent}%
                              </span>{" "}
                              · {option.votes}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p
                  className="text-sm text-slate-500 dark:text-slate-400"
                  aria-live="polite"
                >
                  {hasVoted ? "Your vote is saved · " : ""}
                  {pluralize(totalVotes, "vote")} total
                </p>
              </div>
            ) : (
              <EmptyState
                icon={<PulseIcon className="h-6 w-6" />}
                title="No active poll right now"
                hint="It will appear here as soon as the host starts one."
              />
            )}
          </Card>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="questions-heading">
          <div className="flex items-center justify-between">
            <h2 id="questions-heading" className="text-lg font-semibold">
              Questions
            </h2>
            <div className="flex items-center gap-2">
              {questions.length > 1 && (
                <div
                  role="group"
                  aria-label="Sort questions"
                  className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium dark:bg-slate-800"
                >
                  {ORDERS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={order === option.value}
                      onClick={() => setOrder(option.value)}
                      className={cx(
                        "rounded-md px-3 py-1 transition",
                        order === option.value
                          ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
              {questions.length > 0 && <Badge>{questions.length}</Badge>}
            </div>
          </div>

          <Card>
            <form onSubmit={handleAsk} className="flex flex-col gap-3">
              <TextArea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={MAX_QUESTION_LENGTH}
                rows={3}
                placeholder="Ask something you're curious about..."
                aria-label="Write your question"
              />
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                />
                Ask anonymously
              </label>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs tabular-nums text-slate-500">
                  {draft.length}/{MAX_QUESTION_LENGTH}
                </span>
                <Button
                  type="submit"
                  disabled={asking || draft.trim() === ""}
                >
                  {asking ? "Sending..." : "Send"}
                </Button>
              </div>
            </form>
          </Card>

          {loading ? (
            <QuestionsSkeleton />
          ) : questions.length === 0 ? (
            <Card>
              <EmptyState
                icon={<MessageIcon className="h-6 w-6" />}
                title="No questions yet"
                hint="Be the first to ask, the most upvoted rise to the top."
              />
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {orderQuestions(questions, order).map((question) => {
                const isUpvoted = upvoted.has(question.id);
                return (
                  <li
                    key={question.id}
                    className={cx(
                      "flex animate-slide-in items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900",
                      question.answered && "opacity-70",
                    )}
                  >
                    <button
                      onClick={() => handleUpvote(question.id)}
                      disabled={isUpvoted}
                      aria-label="Upvote question"
                      className={cx(
                        "flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30",
                        isUpvoted
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-slate-200 text-slate-600 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-brand-300",
                      )}
                    >
                      <ChevronUpIcon className="h-4 w-4" />
                      <span className="tabular-nums">{question.upvotes}</span>
                    </button>
                    <div className="min-w-0">
                      <p className="break-words text-base">{question.body}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          {question.displayName} · {timeAgo(question.createdAt)}
                        </span>
                        {question.answered && (
                          <Badge tone="success">Answered</Badge>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function PollSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-7 w-3/4" />
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

function QuestionsSkeleton() {
  return (
    <ul className="flex flex-col gap-3" aria-busy="true">
      {[0, 1, 2].map((n) => (
        <li
          key={n}
          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <Skeleton className="h-14 w-12 shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="mt-2 h-4 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}
