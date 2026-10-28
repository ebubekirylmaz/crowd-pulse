import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { api, ApiError, type HostPoll, type PollStatus } from "../api";
import { clearToken, loadToken } from "../hostAuth";
import { useHostRoom } from "../hooks/useHostRoom";

const STATUS_LABEL: Record<PollStatus, string> = {
  draft: "Taslak",
  active: "Aktif",
  closed: "Kapalı",
};

const STATUS_STYLE: Record<PollStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  active: "bg-green-100 text-green-800",
  closed: "bg-red-100 text-red-800",
};

function percentOf(votes: number, total: number) {
  return total > 0 ? Math.round((votes / total) * 100) : 0;
}

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
      setMessage("Anket oluşturulamadı, tekrar dene");
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
      setMessage("İşlem başarısız, tekrar dene");
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
      <div className="mx-auto max-w-md px-4 py-6 text-center">
        <p className="mb-4">Oda bulunamadı</p>
        <Link to="/host" className="underline">
          Odalarıma dön
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <Link to="/host" className="text-sm text-slate-600 underline">
          ← Odalarım
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{roomTitle ?? code}</h1>
          <span
            className={`h-3 w-3 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
            title={connected ? "Bağlı" : "Bağlantı yok"}
          />
        </div>
      </header>

      {message && <p className="text-sm text-red-600">{message}</p>}

      <section className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 p-4">
        <QRCodeSVG value={joinUrl} size={160} />
        <p className="text-2xl font-bold tracking-widest">{code}</p>
        <p className="break-all text-center text-xs text-slate-500">
          {joinUrl}
        </p>
        <button
          onClick={handleCopy}
          className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
        >
          {copied ? "Kopyalandı" : "Linki kopyala"}
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Yeni anket</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-2">
          <input
            type="text"
            maxLength={200}
            placeholder="Soru"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
          {options.map((option, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                maxLength={100}
                placeholder={`Seçenek ${index + 1}`}
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="rounded-lg border border-slate-300 px-3"
                  aria-label="Seçeneği sil"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {options.length < 10 && (
            <button
              type="button"
              onClick={() => setOptions((prev) => [...prev, ""])}
              className="text-left text-sm text-slate-600 underline"
            >
              + Seçenek ekle
            </button>
          )}
          <button
            type="submit"
            disabled={creating || !canCreate}
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-base font-semibold text-white disabled:opacity-50"
          >
            Anketi oluştur
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Anketler</h2>
        {loading ? (
          <p className="text-slate-600">Yükleniyor...</p>
        ) : polls.length === 0 ? (
          <p className="text-slate-600">Henüz anket yok</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {polls.map((poll) => {
              const total = poll.options.reduce((sum, o) => sum + o.votes, 0);
              return (
                <li
                  key={poll.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{poll.question}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[poll.status]}`}
                    >
                      {STATUS_LABEL[poll.status]}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-1">
                    {poll.options.map((option) => {
                      const percent = percentOf(option.votes, total);
                      return (
                        <li
                          key={option.id}
                          className="relative overflow-hidden rounded border border-slate-200 px-2 py-1"
                        >
                          <span
                            className="absolute inset-y-0 left-0 bg-slate-200 transition-all"
                            style={{ width: `${percent}%` }}
                          />
                          <span className="relative flex justify-between text-sm">
                            <span>{option.label}</span>
                            <span className="text-slate-600">
                              {option.votes} · %{percent}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">{total} oy</p>
                    <button
                      onClick={() => handleToggle(poll)}
                      disabled={busyPollId === poll.id}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
                    >
                      {poll.status === "active" ? "Kapat" : "Aktif et"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Sorular</h2>
        {questions.length === 0 ? (
          <p className="text-slate-600">Henüz soru yok</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {questions.map((q) => (
              <li
                key={q.id}
                className="flex items-start gap-3 rounded-lg border border-slate-200 p-3"
              >
                <div className="flex min-w-10 flex-col items-center rounded-lg border border-slate-300 px-2 py-1">
                  <span>▲</span>
                  <span className="text-sm">{q.upvotes}</span>
                </div>
                <div>
                  <p className="break-words">{q.body}</p>
                  <p className="text-xs text-slate-500">{q.displayName}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
