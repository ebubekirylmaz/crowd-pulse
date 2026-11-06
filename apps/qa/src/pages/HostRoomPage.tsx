import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { api, ApiError, type HostPoll, type PollStatus } from "../api";
import { clearToken, loadToken } from "../hostAuth";
import { useHostRoom } from "../hooks/useHostRoom";
import { percentOf, pluralize, timeAgo } from "../lib/format";
import {
  Alert,
  Badge,
  Button,
  buttonStyles,
  Card,
  cx,
  EmptyState,
  LiveIndicator,
  Logo,
  Spinner,
  TextInput,
  TopBar,
} from "../components/ui";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronUpIcon,
  CopyIcon,
  MessageIcon,
  PlusIcon,
  PresentIcon,
  PulseIcon,
  XIcon,
} from "../components/icons";

const STATUS_LABEL: Record<PollStatus, string> = {
  draft: "Draft",
  active: "Active",
  closed: "Closed",
};

const STATUS_TONE: Record<PollStatus, "neutral" | "success" | "danger"> = {
  draft: "neutral",
  active: "success",
  closed: "danger",
};

export default function HostRoomPage() {
  const { code = "" } = useParams();
  const token = loadToken() ?? "";
  return <HostRoomView code={code} token={token} />;
}

function HostRoomView({ code, token }: { code: string; token: string }) {
  const navigate = useNavigate();
  const {
    connected,
    unauthorized,
    notFound,
    loading,
    polls,
    questions,
    reloadPolls,
  } = useHostRoom(code, token);
  const [roomTitle, setRoomTitle] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busyPollId, setBusyPollId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  if (unauthorized) return null;

  const joinUrl = `${location.origin}/join/${code}`;
  const isLocalHost = ["localhost", "127.0.0.1"].includes(location.hostname);
  const filledOptions = options.map((option) => option.trim()).filter(Boolean);
  const canCreate = question.trim() !== "" && filledOptions.length >= 2;

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setCreating(true);
    setMessage(null);
    try {
      await api.createPoll(token, code, question.trim(), filledOptions);
      setQuestion("");
      setOptions(["", ""]);
      await reloadPolls();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        expire();
        return;
      }
      setMessage("Couldn't create the poll, try again");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(poll: HostPoll) {
    setBusyPollId(poll.id);
    setMessage(null);
    try {
      if (poll.status === "active") {
        await api.closePoll(token, poll.id);
      } else {
        await api.activatePoll(token, poll.id);
      }
      await reloadPolls();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        expire();
        return;
      }
      setMessage("Action failed, try again");
    } finally {
      setBusyPollId(null);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (notFound) {
    return (
      <div className="min-h-dvh">
        <TopBar size="lg" left={<Logo to="/host" />} />
        <main className="mx-auto max-w-md px-4 py-10">
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
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <TopBar
        size="lg"
        left={
          <Link
            to="/host"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            <ArrowLeftIcon />
            My rooms
          </Link>
        }
        right={
          <div className="flex items-center gap-3">
            <Link
              to={`/host/rooms/${code}/present`}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              <PresentIcon />
              Present
            </Link>
            <LiveIndicator connected={connected} />
          </div>
        }
      />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold tracking-tight">
          {roomTitle ?? code}
        </h1>

        {message && (
          <div className="mb-6">
            <Alert>{message}</Alert>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[20rem_1fr] lg:items-start">
          <Card className="flex flex-col items-center gap-4 text-center lg:sticky lg:top-24">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <QRCodeSVG value={joinUrl} size={176} level="M" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Room code
              </p>
              <p className="font-mono text-3xl font-bold tracking-[0.3em]">
                {code}
              </p>
            </div>
            <p className="break-all text-xs text-slate-500 dark:text-slate-400">
              {joinUrl}
            </p>
            {isLocalHost && (
              <Alert tone="info">
                This link only works on this computer. Open this page from the
                live site (or your network address) so the QR code works on
                phones.
              </Alert>
            )}
            <Button variant="secondary" fullWidth onClick={handleCopy}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </Card>

          <div className="flex min-w-0 flex-col gap-8">
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold">New poll</h2>
              <Card>
                <form onSubmit={handleCreate} className="flex flex-col gap-3">
                  <TextInput
                    type="text"
                    maxLength={200}
                    placeholder="Poll question"
                    aria-label="Poll question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                  <div className="flex flex-col gap-2">
                    {options.map((option, index) => (
                      <div key={index} className="flex gap-2">
                        <TextInput
                          type="text"
                          maxLength={100}
                          placeholder={`Option ${index + 1}`}
                          aria-label={`Option ${index + 1}`}
                          value={option}
                          onChange={(e) => updateOption(index, e.target.value)}
                        />
                        {options.length > 2 && (
                          <Button
                            variant="secondary"
                            onClick={() => removeOption(index)}
                            aria-label="Remove option"
                          >
                            <XIcon />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {options.length < 10 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOptions((prev) => [...prev, ""])}
                      >
                        <PlusIcon />
                        Add option
                      </Button>
                    ) : (
                      <span />
                    )}
                    <Button type="submit" disabled={creating || !canCreate}>
                      {creating ? "Creating..." : "Create poll"}
                    </Button>
                  </div>
                </form>
              </Card>
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold">Polls</h2>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Spinner className="h-8 w-8" />
                </div>
              ) : polls.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<PulseIcon className="h-6 w-6" />}
                    title="No polls yet"
                    hint="Create a poll above, then activate it to open it to participants."
                  />
                </Card>
              ) : (
                <ul className="flex flex-col gap-4">
                  {polls.map((poll) => {
                    const total = poll.options.reduce(
                      (sum, o) => sum + o.votes,
                      0,
                    );
                    const isActive = poll.status === "active";
                    return (
                      <li key={poll.id}>
                        <Card
                          className={cx(
                            "flex flex-col gap-4",
                            isActive &&
                              "border-brand-400 ring-2 ring-brand-500/20 dark:border-brand-700",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-lg font-semibold tracking-tight">
                              {poll.question}
                            </h3>
                            <Badge tone={STATUS_TONE[poll.status]}>
                              {STATUS_LABEL[poll.status]}
                            </Badge>
                          </div>
                          <ul className="flex flex-col gap-2">
                            {poll.options.map((option) => {
                              const percent = percentOf(option.votes, total);
                              return (
                                <li
                                  key={option.id}
                                  className="relative overflow-hidden rounded-xl border border-slate-200 px-4 py-2.5 dark:border-slate-700"
                                >
                                  <span
                                    className="absolute inset-y-0 left-0 bg-brand-100 transition-[width] duration-500 ease-out dark:bg-brand-900/50"
                                    style={{ width: `${percent}%` }}
                                  />
                                  <span className="relative flex items-center justify-between gap-3">
                                    <span className="font-medium">
                                      {option.label}
                                    </span>
                                    <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
                                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                                        {percent}%
                                      </span>{" "}
                                      · {option.votes}
                                    </span>
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {pluralize(total, "vote")} total
                            </p>
                            <Button
                              variant={isActive ? "secondary" : "primary"}
                              size="sm"
                              onClick={() => handleToggle(poll)}
                              disabled={busyPollId === poll.id}
                            >
                              {isActive ? "Close" : "Activate"}
                            </Button>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Questions</h2>
                {questions.length > 0 && <Badge>{questions.length}</Badge>}
              </div>
              {questions.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<MessageIcon className="h-6 w-6" />}
                    title="No questions yet"
                    hint="Participants' questions will appear here instantly."
                  />
                </Card>
              ) : (
                <ul className="flex flex-col gap-3">
                  {questions.map((q) => (
                    <li
                      key={q.id}
                      className="flex animate-slide-in items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        <ChevronUpIcon className="h-4 w-4" />
                        <span className="tabular-nums">{q.upvotes}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-base">{q.body}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {q.displayName} · {timeAgo(q.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
