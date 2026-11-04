import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { loadToken, saveToken } from "../hostAuth";
import {
  Alert,
  Button,
  Card,
  cx,
  Field,
  GradientScreen,
  Logo,
  TextInput,
} from "../components/ui";

type Mode = "login" | "register";

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Invalid email or password";
    if (error.status === 409) return "This email is already registered";
    if (error.status === 400) {
      return "Enter a valid email and a password of at least 8 characters";
    }
  }
  return "Something went wrong, try again";
}

const TABS: { mode: Mode; label: string }[] = [
  { mode: "login", label: "Log in" },
  { mode: "register", label: "Sign up" },
];

export default function HostLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loadToken()) {
    return <Navigate to="/host" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const trimmedEmail = email.trim();
      if (mode === "register") {
        await api.register(trimmedEmail, password);
      }
      const { token } = await api.login(trimmedEmail, password);
      saveToken(token);
      navigate("/host");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <GradientScreen>
      <Logo />
      <Card className="w-full animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">Host dashboard</h1>
        <p className="mt-1 mb-5 text-sm text-slate-500 dark:text-slate-400">
          Open rooms, start polls and follow questions live.
        </p>

        <div
          className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
          role="tablist"
        >
          {TABS.map((tab) => (
            <button
              key={tab.mode}
              type="button"
              role="tab"
              aria-selected={mode === tab.mode}
              onClick={() => {
                setMode(tab.mode);
                setError(null);
              }}
              className={cx(
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                mode === tab.mode
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Email">
            <TextInput
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field
            label="Password"
            hint={isLogin ? undefined : "At least 8 characters"}
          >
            <TextInput
              type="password"
              required
              minLength={8}
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" fullWidth disabled={submitting}>
            {submitting
              ? "Please wait..."
              : isLogin
                ? "Log in"
                : "Create account"}
          </Button>
          {error && <Alert>{error}</Alert>}
        </form>
      </Card>
    </GradientScreen>
  );
}
