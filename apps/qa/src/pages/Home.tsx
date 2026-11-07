import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { loadToken, saveToken } from "../hostAuth";
import { track } from "../lib/analytics";
import {
  Alert,
  Badge,
  Button,
  buttonStyles,
  Card,
  Logo,
  TextInput,
} from "../components/ui";
import {
  BoltIcon,
  ChevronUpIcon,
  EyeOffIcon,
  PresentIcon,
  PulseIcon,
  UsersIcon,
} from "../components/icons";

const STEPS = [
  {
    title: "Create a room",
    text: "Sign up as a host and open a room in seconds. You get a join link, a QR code and a short room code.",
  },
  {
    title: "Share the code",
    text: "Participants scan the QR code or type the code on their phone. They only need a name, no account.",
  },
  {
    title: "Engage live",
    text: "Run polls, collect questions and let the audience upvote what matters. Everything updates in real time.",
  },
];

const FEATURES = [
  {
    icon: <PulseIcon className="h-5 w-5" />,
    title: "Live polls",
    text: "Results update as votes arrive, with one vote per participant.",
  },
  {
    icon: <ChevronUpIcon className="h-5 w-5" />,
    title: "Upvoted questions",
    text: "The questions people care about rise to the top.",
  },
  {
    icon: <EyeOffIcon className="h-5 w-5" />,
    title: "Anonymous questions",
    text: "Participants can ask without showing their name.",
  },
  {
    icon: <PresentIcon className="h-5 w-5" />,
    title: "Presenter mode",
    text: "A full-screen view for projectors with results, QR code and top questions.",
  },
  {
    icon: <UsersIcon className="h-5 w-5" />,
    title: "No sign-up to join",
    text: "Open the link, pick a name and you are in.",
  },
  {
    icon: <BoltIcon className="h-5 w-5" />,
    title: "Built on WebSockets",
    text: "Socket.IO keeps every screen in sync without refreshing.",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const loggedIn = loadToken() !== null;

  function handleJoin(e: FormEvent) {
    e.preventDefault();
    const normalized = code.replace(/\s/g, "").toUpperCase();
    if (!normalized) return;
    navigate(`/join/${normalized}`);
  }

  async function handleDemo() {
    setDemoLoading(true);
    setDemoError(null);
    try {
      const { token, code: demoCode } = await api.startDemo();
      saveToken(token);
      track("demo_start");
      navigate(`/host/rooms/${demoCode}`);
    } catch (error) {
      setDemoError(
        error instanceof ApiError && error.status === 429
          ? "Too many demo requests from your network, try again in an hour"
          : "Couldn't start the demo, try again",
      );
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-linear-to-b from-brand-50 via-slate-50 to-slate-50 dark:from-brand-950 dark:via-slate-950 dark:to-slate-950">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Logo />
        <Link
          to={loggedIn ? "/host" : "/host/login"}
          className={buttonStyles({ variant: "ghost", size: "sm" })}
        >
          {loggedIn ? "Dashboard" : "Host login"}
        </Link>
      </header>

      <main>
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 pb-16 pt-10 text-center">
          <Badge tone="brand">Live polls and Q&A</Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Ask. Vote. See it live.
          </h1>
          <p className="max-w-xl text-lg text-slate-600 dark:text-slate-400">
            Create a room, share a code and watch votes and questions arrive
            instantly. Participants join from their phone with just a name.
          </p>

          <div className="flex flex-col items-center gap-3">
            {loggedIn ? (
              <Link to="/host" className={buttonStyles({ size: "lg" })}>
                Open your dashboard
              </Link>
            ) : (
              <Button size="lg" onClick={handleDemo} disabled={demoLoading}>
                {demoLoading ? "Preparing your demo..." : "Try the live demo"}
              </Button>
            )}
            {!loggedIn && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Opens a ready-made room as the host. No sign-up needed.
              </p>
            )}
            {demoError && <Alert>{demoError}</Alert>}
          </div>

          <Card className="w-full max-w-md text-left">
            <form onSubmit={handleJoin} className="flex flex-col gap-3">
              <label
                htmlFor="room-code"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Have a room code?
              </label>
              <div className="flex gap-2">
                <TextInput
                  id="room-code"
                  type="text"
                  maxLength={12}
                  placeholder="e.g. F7R28W"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  className="text-center font-mono text-lg uppercase tracking-[0.25em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <Button
                  type="submit"
                  disabled={code.trim() === ""}
                  className="shrink-0"
                >
                  Join
                </Button>
              </div>
            </form>
          </Card>
        </section>

        <section
          aria-labelledby="how-heading"
          className="mx-auto max-w-5xl px-4 py-12"
        >
          <h2
            id="how-heading"
            className="mb-8 text-center text-2xl font-bold tracking-tight sm:text-3xl"
          >
            How it works
          </h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full">
                  <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {step.text}
                  </p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="features-heading"
          className="mx-auto max-w-5xl px-4 py-12"
        >
          <h2
            id="features-heading"
            className="mb-8 text-center text-2xl font-bold tracking-tight sm:text-3xl"
          >
            Everything a live session needs
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <li key={feature.title}>
                <Card className="h-full">
                  <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    {feature.icon}
                  </span>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {feature.text}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Built by Ebubekir Yılmaz ·{" "}
        <a
          href="https://github.com/ebubekirylmaz/crowd-pulse"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-slate-700 dark:hover:text-slate-200"
        >
          Source on GitHub
        </a>
      </footer>
    </div>
  );
}
