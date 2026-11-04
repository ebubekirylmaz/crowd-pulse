import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type HostRoom } from "../api";
import { clearToken, loadToken } from "../hostAuth";
import { formatDate } from "../lib/format";
import {
  Alert,
  Badge,
  Button,
  buttonStyles,
  Card,
  EmptyState,
  Logo,
  Spinner,
  TextInput,
  TopBar,
} from "../components/ui";
import { CheckIcon, CopyIcon, LogOutIcon, PulseIcon } from "../components/icons";

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
        setLoadError("Couldn't load rooms, refresh the page and try again");
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
      setCreateError("Couldn't create the room, try again");
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
    <div className="min-h-dvh">
      <TopBar
        size="lg"
        left={<Logo to="/host" />}
        right={
          <Button variant="ghost" size="sm" onClick={expire}>
            <LogOutIcon />
            Log out
          </Button>
        }
      />
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My rooms</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Create a room and share it with your participants.
          </p>
        </div>

        <Card>
          <form
            onSubmit={handleCreate}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <TextInput
              type="text"
              maxLength={100}
              placeholder="New room title, e.g. Weekly meeting"
              aria-label="Room title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Button
              type="submit"
              disabled={creating || title.trim() === ""}
              className="shrink-0 sm:w-auto"
            >
              {creating ? "Creating..." : "Create room"}
            </Button>
          </form>
          {createError && (
            <div className="mt-3">
              <Alert>{createError}</Alert>
            </div>
          )}
        </Card>

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-8 w-8" />
          </div>
        ) : loadError ? (
          <Alert>{loadError}</Alert>
        ) : rooms.length === 0 ? (
          <Card>
            <EmptyState
              icon={<PulseIcon className="h-6 w-6" />}
              title="No rooms yet"
              hint="Create your first room above, the join link and QR code are ready instantly."
            />
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {rooms.map((room) => (
              <li key={room.id}>
                <Card className="flex h-full flex-col gap-4 animate-fade-in">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">
                      {room.title}
                    </h2>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge tone="brand">
                        <span className="font-mono tracking-wider">
                          {room.code}
                        </span>
                      </Badge>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(room.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-auto flex gap-2">
                    <Link
                      to={`/host/rooms/${room.code}`}
                      className={buttonStyles({ size: "sm" })}
                    >
                      Manage
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCopy(room.code)}
                    >
                      {copiedCode === room.code ? <CheckIcon /> : <CopyIcon />}
                      {copiedCode === room.code ? "Copied" : "Copy link"}
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
