"use client";
import { Delete, Fingerprint, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, cn } from "./ui";
import * as vault from "@/lib/vault";

type Props = {
  mode: "setup" | "unlock";
  onUnlocked: (key: CryptoKey) => void;
  onError: () => void;
};

const FAIL_KEY = "diario-fails";

function readFails(): { count: number; until: number } {
  try {
    return JSON.parse(localStorage.getItem(FAIL_KEY) || "") as { count: number; until: number };
  } catch {
    return { count: 0, until: 0 };
  }
}

export function LockScreen({ mode, onUnlocked, onError }: Props) {
  const [kind, setKind] = useState<"pin" | "password">("pin");
  const [value, setValue] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [bio, setBio] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (mode === "unlock") {
      vault.masterKind().then(setKind);
      vault.hasBiometric().then(setBio);
    }
  }, [mode]);

  useEffect(() => {
    const tick = () => setCooldown(Math.max(0, Math.ceil((readFails().until - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, []);

  const fail = useCallback(
    (msg: string) => {
      setError(msg);
      setShake(true);
      setValue("");
      onError();
      setTimeout(() => setShake(false), 500);
    },
    [onError],
  );

  const tryUnlock = useCallback(
    async (secret: string) => {
      if (cooldown > 0) return;
      setBusy(true);
      try {
        const key = await vault.unlockWithSecret(secret);
        localStorage.removeItem(FAIL_KEY);
        onUnlocked(key);
      } catch {
        const f = readFails();
        const count = f.count + 1;
        // Após 5 erros, espera crescente: 30s, 60s, 120s...
        const until = count >= 5 ? Date.now() + 30_000 * 2 ** (count - 5) : 0;
        localStorage.setItem(FAIL_KEY, JSON.stringify({ count, until }));
        fail(count >= 5 ? "Muitas tentativas. Aguarde para tentar novamente." : "PIN ou senha incorretos");
      } finally {
        setBusy(false);
      }
    },
    [cooldown, fail, onUnlocked],
  );

  const trySetup = useCallback(
    async (secret: string) => {
      if (kind === "pin" && !/^\d{4,6}$/.test(secret)) return fail("O PIN deve ter de 4 a 6 dígitos");
      if (kind === "password" && secret.length < 8) return fail("A senha deve ter pelo menos 8 caracteres");
      if (confirm === null) {
        setConfirm(secret);
        setValue("");
        setError("");
        return;
      }
      if (confirm !== secret) {
        setConfirm(null);
        return fail("Não confere. Comece de novo.");
      }
      setBusy(true);
      onUnlocked(await vault.setupMaster(secret, kind));
    },
    [confirm, fail, kind, onUnlocked],
  );

  const submit = (v = value) => (mode === "setup" ? trySetup(v) : tryUnlock(v));

  const unlockBio = async () => {
    setBusy(true);
    try {
      onUnlocked(await vault.unlockWithBiometric());
    } catch (e) {
      fail(e instanceof Error && e.name !== "NotAllowedError" ? e.message : "Biometria cancelada");
    } finally {
      setBusy(false);
    }
  };

  // Teclado físico no modo PIN
  useEffect(() => {
    if (kind !== "pin") return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setValue((v) => (v.length < 6 ? v + e.key : v));
      else if (e.key === "Backspace") setValue((v) => v.slice(0, -1));
      else if (e.key === "Enter") submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const press = (d: string) => {
    const v = value.length < 6 ? value + d : value;
    setValue(v);
    setError("");
    // No desbloqueio, tenta automaticamente a partir de 4 dígitos sem penalizar tentativas parciais.
    if (mode === "unlock" && v.length >= 4) {
      vault
        .unlockWithSecret(v)
        .then((k) => {
          localStorage.removeItem(FAIL_KEY);
          onUnlocked(k);
        })
        .catch(() => {
          if (v.length === 6) tryUnlock(v);
        });
    }
  };

  const title = mode === "setup" ? (confirm === null ? "Crie sua tranca" : "Confirme") : "Diário bloqueado";
  const subtitle =
    mode === "setup"
      ? confirm === null
        ? "Seus dados serão cifrados no dispositivo com esta chave. Ela não pode ser recuperada."
        : kind === "pin"
          ? "Digite o PIN novamente"
          : "Digite a senha novamente"
      : kind === "pin"
        ? "Digite seu PIN"
        : "Digite sua senha master";

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className={cn("w-full max-w-sm p-6 shadow-xl", shake && "shake")}>
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            {mode === "setup" ? <ShieldCheck size={28} /> : <Lock size={26} />}
          </div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>

        {mode === "setup" && confirm === null && (
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-ui bg-surface-2 p-1 text-sm">
            {(["pin", "password"] as const).map((k) => (
              <button
                key={k}
                onClick={() => {
                  setKind(k);
                  setValue("");
                }}
                className={cn("rounded-ui py-1.5", kind === k ? "bg-surface font-medium shadow-sm" : "text-muted")}
              >
                {k === "pin" ? "PIN numérico" : "Senha master"}
              </button>
            ))}
          </div>
        )}

        {kind === "pin" ? (
          <>
            <div className="mb-5 flex justify-center gap-3" aria-label="PIN digitado">
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-3.5 w-3.5 rounded-full transition",
                    i < value.length ? "scale-110 bg-primary" : i < 4 ? "bg-surface-2 ring-1 ring-border" : "bg-surface-2 opacity-50",
                  )}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <Button key={d} variant="secondary" size="lg" className="h-14 text-xl" onClick={() => press(d)} disabled={busy || cooldown > 0}>
                  {d}
                </Button>
              ))}
              {bio && mode === "unlock" ? (
                <Button variant="ghost" size="lg" className="h-14" onClick={unlockBio} aria-label="Desbloquear com biometria">
                  <Fingerprint size={24} />
                </Button>
              ) : (
                <span />
              )}
              <Button variant="secondary" size="lg" className="h-14 text-xl" onClick={() => press("0")} disabled={busy || cooldown > 0}>
                0
              </Button>
              <Button variant="ghost" size="lg" className="h-14" onClick={() => setValue((v) => v.slice(0, -1))} aria-label="Apagar">
                <Delete size={22} />
              </Button>
            </div>
            {(mode === "setup" || value.length >= 4) && (
              <Button className="mt-4 w-full" onClick={() => submit()} disabled={busy || value.length < 4 || cooldown > 0}>
                {mode === "setup" ? (confirm === null ? "Continuar" : "Criar diário") : "Desbloquear"}
              </Button>
            )}
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="space-y-3"
          >
            <Input
              type="password"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Senha"
              autoComplete={mode === "setup" ? "new-password" : "current-password"}
            />
            <Button type="submit" className="w-full" disabled={busy || !value || cooldown > 0}>
              <KeyRound size={16} />
              {mode === "setup" ? (confirm === null ? "Continuar" : "Criar diário") : "Desbloquear"}
            </Button>
            {bio && mode === "unlock" && (
              <Button type="button" variant="outline" className="w-full" onClick={unlockBio}>
                <Fingerprint size={16} /> Usar biometria
              </Button>
            )}
          </form>
        )}

        <p className={cn("mt-4 min-h-5 text-center text-sm", error ? "text-danger" : "text-muted")}>
          {cooldown > 0 ? `Tente novamente em ${cooldown}s` : error || (busy ? "Abrindo cofre…" : "")}
        </p>
      </Card>
    </div>
  );
}
