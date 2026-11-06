import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { api, type HostPoll } from "../api";
import { clearToken, loadToken } from "../hostAuth";
import { useHostRoom } from "../hooks/useHostRoom";
import { usePageTitle } from "../hooks/usePageTitle";
import { percentOf, pluralize } from "../lib/format";
import {
  Badge,
  Button,
  buttonStyles,
  Card,
  cx,
  EmptyState,
  LiveIndicator,
  Logo,
  Spinner,
} from "../components/ui";
import {
  ArrowLeftIcon,
  ChevronUpIcon,
  ExpandIcon,
  PulseIcon,
} from "../components/icons";

const TOP_QUESTION_COUNT = 5;

export default function HostPresent() {
  const { code = "" } = useParams();
  const token = loadToken() ?? "";
  return <PresentView code={code} token={token} />;
}

function PresentView({ code, token }: { code: string; token: string }) {
  const navigate = useNavigate();
  const { connected, unauthorized, notFound, loading, polls, questions } =
    useHostRoom(code, token);
  const [roomTitle, setRoomTitle] = useState<string | null>(null);
  usePageTitle(roomTitle ? `Presenting ${roomTitle}` : null);

  const expire = useCallback(() => {
    clearToken();
    navigate("/host/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    api
      .getRoom(code)
      .then((room) => setRoomTitle(room.title))
      .catch(() => setRoomTitle(null));
  }, [code]);

  useEffect(() => {
    if (unauthorized) expire();
  }, [unauthorized, expire]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !document.fullscreenElement) {
        navigate(`/host/rooms/${code}`);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [code, navigate]);

  if (unauthorized) return null;

  async function enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      return;
    }
  }

  const joinUrl = `${location.origin}/join/${code}`;
  const shownPoll =
    polls.find((poll) => poll.status === "active") ??
    polls.find((poll) => poll.status === "closed") ??
    null;
  const topQuestions = questions.slice(0, TOP_QUESTION_COUNT);

  if (notFound) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <Card>
          <EmptyState
            icon={<PulseIcon className="h-6 w-6" />}
            title="Room not found"
            hint="This room may have been deleted or may not belong to you."
          />
          <div className="flex justify-center pb-2">
            <Link to="/host" className={buttonStyles({ size: "sm" })}>
              Back to my rooms
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="hidden text-lg font-medium text-slate-500 sm:inline dark:text-slate-400">
            {roomTitle ?? code}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <LiveIndicator connected={connected} />
          <Button variant="secondary" size="sm" onClick={enterFullscreen}>
            <ExpandIcon />
            Fullscreen
          </Button>
          <Link
            to={`/host/rooms/${code}`}
            className={buttonStyles({ variant: "ghost", size: "sm" })}
          >
            <ArrowLeftIcon />
            Exit
          </Link>
        </div>
      </header>

      <main className="grid flex-1 gap-8 px-6 pb-8 lg:grid-cols-[1fr_24rem]">
        <section className="flex min-w-0 flex-col justify-center">
          {loading ? (
            <div className="flex justify-center">
              <Spinner className="h-12 w-12" />
            </div>
          ) : shownPoll ? (
            <PresentPoll poll={shownPoll} />
          ) : (
            <div className="flex flex-col items-center gap-6 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                <PulseIcon className="h-10 w-10" />
              </span>
              <h2 className="text-4xl font-bold tracking-tight sm:text-6xl">
                Scan to join
              </h2>
              <p className="max-w-xl text-xl text-slate-500 dark:text-slate-400">
                Use the QR code or enter the room code on the home page. Polls
                appear here as soon as you activate one.
              </p>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-6">
          <Card className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <QRCodeSVG value={joinUrl} size={224} level="M" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Room code
              </p>
              <p className="font-mono text-5xl font-bold tracking-[0.25em]">
                {code}
              </p>
            </div>
            <p className="break-all text-sm text-slate-500 dark:text-slate-400">
              {joinUrl}
            </p>
          </Card>

          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Top questions</h2>
              {questions.length > 0 && <Badge>{questions.length}</Badge>}
            </div>
            {topQuestions.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400">
                Questions from participants will show up here.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {topQuestions.map((question) => (
                  <li key={question.id} className="flex items-start gap-3">
                    <span className="flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold dark:border-slate-700">
                      <ChevronUpIcon className="h-4 w-4" />
                      <span className="tabular-nums">{question.upvotes}</span>
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-lg leading-snug">
                        {question.body}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {question.displayName}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </main>
    </div>
  );
}

function PresentPoll({ poll }: { poll: HostPoll }) {
  const total = poll.options.reduce((sum, option) => sum + option.votes, 0);
  const topVotes = Math.max(0, ...poll.options.map((option) => option.votes));
  const isClosed = poll.status === "closed";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div>
          <Badge tone={isClosed ? "neutral" : "brand"}>
            {isClosed ? "Final results" : "Live poll"}
          </Badge>
        </div>
        <h2 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          {poll.question}
        </h2>
      </div>

      <ul className="flex flex-col gap-4">
        {poll.options.map((option) => {
          const percent = percentOf(option.votes, total);
          const isWinner = isClosed && topVotes > 0 && option.votes === topVotes;
          return (
            <li
              key={option.id}
              className={cx(
                "relative overflow-hidden rounded-2xl border px-6 py-5",
                isWinner
                  ? "border-brand-500 ring-2 ring-brand-500/30"
                  : "border-slate-200 dark:border-slate-700",
              )}
            >
              <span
                className={cx(
                  "absolute inset-y-0 left-0 transition-[width] duration-700 ease-out",
                  isWinner
                    ? "bg-brand-300/70 dark:bg-brand-700/60"
                    : "bg-brand-100 dark:bg-brand-900/50",
                )}
                style={{ width: `${percent}%` }}
              />
              <span className="relative flex items-center justify-between gap-6">
                <span className="text-2xl font-semibold sm:text-4xl">
                  {option.label}
                </span>
                <span className="flex items-baseline gap-3 tabular-nums">
                  <span className="text-3xl font-bold sm:text-5xl">
                    {percent}%
                  </span>
                  <span className="text-lg text-slate-500 dark:text-slate-400">
                    {option.votes}
                  </span>
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-xl text-slate-500 dark:text-slate-400">
        {pluralize(total, "vote")} total
      </p>
    </div>
  );
}
