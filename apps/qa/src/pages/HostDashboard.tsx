import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type HostRoom } from "../api";
import { clearToken, loadToken } from "../hostAuth";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HostDashboard() {
  const navigate = useNavigate();
  const token = loadToken() ?? "";
  const [rooms, setRooms] = useState<HostRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const expire = useCallback(() => {
    clearToken();
    navigate("/host/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    api
      .listRooms(token)
      .then((list) => {
        if (!cancelled) setRooms(list);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          expire();
          return;
        }
        setLoadError("Odalar yüklenemedi, sayfayı yenileyip tekrar dene");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, expire]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setCreating(true);
    setCreateError(null);
    try {
      const room = await api.createRoom(token, trimmed);
      setRooms((prev) => [room, ...prev]);
      setTitle("");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        expire();
        return;
      }
      setCreateError("Oda oluşturulamadı, tekrar dene");
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(`${location.origin}/join/${code}`);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      setCopiedCode(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Odalarım</h1>
        <button
          onClick={expire}
          className="text-sm text-slate-600 underline"
        >
          Çıkış yap
        </button>
      </header>

      <form onSubmit={handleCreate} className="flex flex-col gap-2">
        <input
          type="text"
          maxLength={100}
          placeholder="Yeni oda başlığı"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
        <button
          type="submit"
          disabled={creating || title.trim() === ""}
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-base font-semibold text-white disabled:opacity-50"
        >
          Oda oluştur
        </button>
        {createError && (
          <p className="text-center text-sm text-red-600">{createError}</p>
        )}
      </form>

      {loading ? (
        <p className="text-center text-slate-600">Yükleniyor...</p>
      ) : loadError ? (
        <p className="text-center text-red-600">{loadError}</p>
      ) : rooms.length === 0 ? (
        <p className="text-center text-slate-600">Henüz oda yok</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rooms.map((room) => (
            <li
              key={room.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
            >
              <Link to={`/host/rooms/${room.code}`} className="min-w-0 flex-1">
                <p className="truncate font-semibold">{room.title}</p>
                <p className="text-xs text-slate-500">
                  {room.code} · {formatDate(room.createdAt)}
                </p>
              </Link>
              <button
                onClick={() => handleCopy(room.code)}
                className="shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-sm"
              >
                {copiedCode === room.code ? "Kopyalandı" : "Linki kopyala"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
