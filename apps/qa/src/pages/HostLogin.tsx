import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { loadToken, saveToken } from "../hostAuth";

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
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-bold">
          {isLogin ? "Host girişi" : "Host kaydı"}
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
          <input
            type="password"
            required
            minLength={8}
            autoComplete={isLogin ? "current-password" : "new-password"}
            placeholder="Parola (en az 8 karakter)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-base font-semibold text-white disabled:opacity-50"
          >
            {isLogin ? "Giriş yap" : "Kayıt ol"}
          </button>
          {error && <p className="text-center text-sm text-red-600">{error}</p>}
        </form>
        <button
          type="button"
          onClick={() => {
            setMode(isLogin ? "register" : "login");
            setError(null);
          }}
          className="mt-4 w-full text-center text-sm text-slate-600 underline"
        >
          {isLogin ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
        </button>
      </div>
    </div>
  );
}
