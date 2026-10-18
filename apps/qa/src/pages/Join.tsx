import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError, type Room } from "../api";
import { loadSession, saveSession } from "../session";

export default function Join() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loadSession(code)) {
      navigate(`/r/${code}`, { replace: true });
      return;
    }
    let cancelled = false;
    api
      .getRoom(code)
      .then((room) => {
        if (!cancelled) setRoom(room);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(
          error instanceof ApiError && error.status === 404
            ? "Oda bulunamadı"
            : "Bir sorun oluştu, sayfayı yenileyip tekrar dene",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    api
      .joinRoom(code, displayName.trim())
      .then((response) => {
        saveSession(code, {
          sessionToken: response.sessionToken,
          displayName: response.participant.displayName,
        });
        navigate(`/r/${code}`);
      })
      .catch((error) => {
        setSubmitError(
          error instanceof ApiError && error.status === 404
            ? "Oda bulunamadı"
            : "Katılamadın, tekrar dene",
        );
      })
      .finally(() => setSubmitting(false));
  }

  if (loading) {
    return <div className="p-4 text-center">Yükleniyor...</div>;
  }
  if (loadError || !room) {
    return <div className="p-4 text-center">{loadError ?? "Oda bulunamadı"}</div>;
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-bold">{room.title}</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            maxLength={40}
            placeholder="Adın"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
          <button
            type="submit"
            disabled={submitting || displayName.trim() === ""}
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-base font-semibold text-white disabled:opacity-50"
          >
            Katıl
          </button>
          {submitError && (
            <p className="text-center text-sm text-red-600">{submitError}</p>
          )}
        </form>
      </div>
    </div>
  );
}
