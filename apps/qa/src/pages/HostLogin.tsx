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
    if (error.status === 401) return "E-posta ya da parola hatalı";
    if (error.status === 409) return "Bu e-posta zaten kayıtlı";
    if (error.status === 400) {
      return "Geçerli bir e-posta ve en az 8 karakterlik parola gir";
    }
  }
  return "Bir sorun oluştu, tekrar dene";
}

const TABS: { mode: Mode; label: string }[] = [
  { mode: "login", label: "Giriş yap" },
  { mode: "register", label: "Kayıt ol" },
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
        <h1 className="text-2xl font-bold tracking-tight">Host paneli</h1>
        <p className="mt-1 mb-5 text-sm text-slate-500 dark:text-slate-400">
          Oda aç, anket başlat, soruları canlı takip et.
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
          <Field label="E-posta">
            <TextInput
              type="email"
              required
              autoComplete="email"
              placeholder="ornek@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field
            label="Parola"
            hint={isLogin ? undefined : "En az 8 karakter"}
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
            {submitting ? "Bekle..." : isLogin ? "Giriş yap" : "Hesap oluştur"}
          </Button>
          {error && <Alert>{error}</Alert>}
        </form>
      </Card>
    </GradientScreen>
  );
}
