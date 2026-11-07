import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError, type Room } from "../api";
import { loadSession, saveSession } from "../session";
import { usePageTitle } from "../hooks/usePageTitle";
import { emit } from "@crowd-pulse/events";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  GradientScreen,
  Logo,
  Spinner,
  TextInput,
} from "../components/ui";
import { PulseIcon } from "../components/icons";

export default function Join() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  usePageTitle(room ? `Join ${room.title}` : "Join a room");

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
            ? "Room not found"
            : "Something went wrong, refresh the page and try again",
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
        emit("room:joined", {});
        navigate(`/r/${code}`);
      })
      .catch((error) => {
        setSubmitError(
          error instanceof ApiError && error.status === 404
            ? "Room not found"
            : "Couldn't join, try again",
        );
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <GradientScreen>
      <Logo />
      {loading ? (
        <Spinner className="h-8 w-8" />
      ) : loadError || !room ? (
        <Card className="w-full">
          <EmptyState
            icon={<PulseIcon className="h-6 w-6" />}
            title={loadError ?? "Room not found"}
            hint="Check the link or room code and try again."
          />
        </Card>
      ) : (
        <Card className="w-full animate-fade-in">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            You're joining
          </p>
          <h1 className="mt-1 mb-6 text-2xl font-bold tracking-tight">
            {room.title}
          </h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field
              label="Your name"
              hint="Other participants will see this name next to your questions."
            >
              <TextInput
                type="text"
                maxLength={40}
                placeholder="e.g. Alex"
                autoComplete="nickname"
                autoFocus
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </Field>
            <Button
              type="submit"
              size="lg"
              fullWidth
              disabled={submitting || displayName.trim() === ""}
            >
              {submitting ? "Joining..." : "Join"}
            </Button>
            {submitError && <Alert>{submitError}</Alert>}
          </form>
        </Card>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        No account needed · Room code {code.toUpperCase()}
      </p>
    </GradientScreen>
  );
}
