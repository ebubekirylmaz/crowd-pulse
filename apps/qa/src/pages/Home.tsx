import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  buttonStyles,
  Card,
  Field,
  GradientScreen,
  Logo,
  TextInput,
} from "../components/ui";

export default function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const normalized = code.replace(/\s/g, "").toUpperCase();
    if (!normalized) return;
    navigate(`/join/${normalized}`);
  }

  return (
    <GradientScreen>
      <Logo />
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Canlı soru-cevap ve anket
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Tek bir kodla odaya katıl, oy ver, soru sor. Sonuçlar anında
          güncellenir.
        </p>
      </div>
      <Card className="w-full">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Oda kodu" hint="Host'un paylaştığı kodu ya da QR'ı kullan.">
            <TextInput
              type="text"
              maxLength={12}
              placeholder="Örn. F7R28W"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="text-center font-mono text-xl uppercase tracking-[0.3em]"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          <Button
            type="submit"
            size="lg"
            fullWidth
            disabled={code.trim() === ""}
          >
            Odaya katıl
          </Button>
        </form>
      </Card>
      <Link
        to="/host/login"
        className={buttonStyles({ variant: "ghost", size: "sm" })}
      >
        Oda mı açmak istiyorsun? Host girişi
      </Link>
    </GradientScreen>
  );
}
