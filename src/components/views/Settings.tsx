"use client";
import { Fingerprint, KeyRound, Palette, ShieldAlert, Timer, Type, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FONTS, THEMES, type ThemeKey } from "@/lib/types";
import * as vault from "@/lib/vault";
import { biometricAvailable } from "@/lib/webauthn";
import { useApp } from "../AppContext";
import { Button, Card, Dialog, Input, Switch, cn } from "../ui";

const SWATCH: Record<ThemeKey, string[]> = {
  dark: ["#0f1115", "#1f232c", "#a5b4fc"],
  light: ["#f7f7f5", "#ffffff", "#2b2b2b"],
  feminino: ["#fbf4f7", "#f6e8f0", "#c0648f", "#a78bfa"],
  masculino: ["#0d1626", "#1a2a43", "#5b8bd6"],
  infantil: ["#fff8e7", "#ffd166", "#ff6b6b", "#4ecdc4"],
  business: ["#f3f4f6", "#ffffff", "#1f3a5f", "#0f766e"],
};

function Section({ icon: I, title, children }: { icon: typeof Palette; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <I size={18} className="text-primary" /> {title}
      </h2>
      {children}
    </Card>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export function Settings() {
  const { settings, updateSettings, key, fb } = useApp();
  const [bioOn, setBioOn] = useState(false);
  const [bioAvail, setBioAvail] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [kind, setKind] = useState<"pin" | "password">("pin");
  const [s1, setS1] = useState("");
  const [s2, setS2] = useState("");
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeText, setWipeText] = useState("");

  useEffect(() => {
    vault.hasBiometric().then(setBioOn);
    biometricAvailable().then(setBioAvail);
  }, []);

  const toggleBio = async (on: boolean) => {
    try {
      if (on) {
        await vault.enableBiometric(key);
        toast.success("Biometria ativada");
      } else {
        await vault.disableBiometric();
        toast("Biometria desativada");
      }
      setBioOn(on);
    } catch (e) {
      toast.error(e instanceof Error && e.name !== "NotAllowedError" ? e.message : "Operação cancelada");
    }
  };

  const changeSecret = async () => {
    if (kind === "pin" && !/^\d{4,6}$/.test(s1)) return toast.error("O PIN deve ter de 4 a 6 dígitos");
    if (kind === "password" && s1.length < 8) return toast.error("A senha deve ter pelo menos 8 caracteres");
    if (s1 !== s2) return toast.error("Não confere");
    await vault.changeMaster(key, s1, kind);
    setChangeOpen(false);
    setS1("");
    setS2("");
    fb("save");
    toast.success("Tranca atualizada");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-28">
      <Section icon={Palette} title="Tema">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {THEMES.map((t) => (
            <button
              key={t.key}
              onClick={() => updateSettings({ theme: t.key })}
              className={cn(
                "bw rounded-ui border p-3 text-left transition",
                settings.theme === t.key ? "border-primary ring-2 ring-primary/30" : "border-border hover:bg-surface-2",
              )}
            >
              <div className="mb-2 flex gap-1">
                {SWATCH[t.key].map((c) => (
                  <span key={c} className="h-5 w-5 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                ))}
              </div>
              <span className="text-sm font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section icon={Type} title="Tipografia">
        {(["Profissional", "Estilizada"] as const).map((g) => (
          <div key={g} className="mb-3 last:mb-0">
            <div className="mb-1.5 text-xs text-muted uppercase">{g === "Profissional" ? "Profissionais / formais" : "Estilizadas / cursivas"}</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {FONTS.filter((f) => f.group === g).map((f) => (
                <button
                  key={f.key}
                  onClick={() => updateSettings({ font: f.key })}
                  data-font={f.key}
                  style={{ fontFamily: "var(--font-selected)" }}
                  className={cn(
                    "bw rounded-ui border p-3 text-left",
                    settings.font === f.key ? "border-primary ring-2 ring-primary/30" : "border-border hover:bg-surface-2",
                  )}
                >
                  <div className="text-lg">Querido diário</div>
                  <div className="text-xs text-muted">{f.label}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section icon={Timer} title="Bloqueio automático">
        <div className="mb-2 grid grid-cols-5 gap-1 rounded-ui bg-surface-2 p-1 text-sm">
          {[
            [1, "1 min"],
            [5, "5 min"],
            [15, "15 min"],
            [30, "30 min"],
            [0, "Nunca"],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => updateSettings({ autoLockMinutes: v as number })}
              className={cn("rounded-ui py-1.5", settings.autoLockMinutes === v ? "bg-surface font-medium shadow-sm" : "text-muted")}
            >
              {l}
            </button>
          ))}
        </div>
        <Row label="Bloquear ao minimizar ou trocar de aba">
          <Switch checked={settings.lockOnHide} onChange={(v) => updateSettings({ lockOnHide: v })} label="Bloquear ao minimizar" />
        </Row>
      </Section>

      <Section icon={KeyRound} title="Acesso">
        <Row
          label="Desbloqueio biométrico"
          hint={bioAvail ? "Touch ID, Face ID ou Windows Hello via WebAuthn" : "Nenhum autenticador biométrico detectado neste dispositivo"}
        >
          <Switch checked={bioOn} onChange={toggleBio} label="Biometria" />
        </Row>
        <Row label="PIN / senha master">
          <Button variant="outline" size="sm" onClick={() => setChangeOpen(true)}>
            Alterar
          </Button>
        </Row>
      </Section>

      <Section icon={Volume2} title="Feedback">
        <Row label="Som sutil ao desbloquear e salvar">
          <Switch checked={settings.sound} onChange={(v) => updateSettings({ sound: v })} label="Som" />
        </Row>
        <Row label="Vibração (celular)">
          <Switch checked={settings.haptics} onChange={(v) => updateSettings({ haptics: v })} label="Vibração" />
        </Row>
      </Section>

      <Section icon={Fingerprint} title="Privacidade">
        <p className="text-sm text-muted">
          Tudo é cifrado com AES-GCM 256 no seu dispositivo antes de ser salvo. Nada é enviado para servidores. Se você esquecer o PIN/senha, os dados não podem
          ser recuperados; mantenha backups em dia na aba Ciclo.
        </p>
      </Section>

      <Section icon={ShieldAlert} title="Zona de perigo">
        <Row label="Apagar tudo deste dispositivo" hint="Diário, cofre secreto, fotos e configurações">
          <Button variant="danger" size="sm" onClick={() => setWipeOpen(true)}>
            Apagar
          </Button>
        </Row>
      </Section>

      <Dialog open={changeOpen} onClose={() => setChangeOpen(false)} title="Nova tranca">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-ui bg-surface-2 p-1 text-sm">
            {(["pin", "password"] as const).map((k) => (
              <button key={k} onClick={() => setKind(k)} className={cn("rounded-ui py-1.5", kind === k ? "bg-surface font-medium shadow-sm" : "text-muted")}>
                {k === "pin" ? "PIN numérico" : "Senha master"}
              </button>
            ))}
          </div>
          <Input
            type="password"
            inputMode={kind === "pin" ? "numeric" : undefined}
            value={s1}
            onChange={(e) => setS1(e.target.value)}
            placeholder={kind === "pin" ? "Novo PIN (4 a 6 dígitos)" : "Nova senha"}
          />
          <Input type="password" inputMode={kind === "pin" ? "numeric" : undefined} value={s2} onChange={(e) => setS2(e.target.value)} placeholder="Repita" />
          <Button className="w-full" onClick={changeSecret}>
            Salvar
          </Button>
        </div>
      </Dialog>

      <Dialog open={wipeOpen} onClose={() => setWipeOpen(false)} title="Apagar tudo?">
        <p className="mb-3 text-sm text-muted">Isso remove permanentemente todos os dados deste dispositivo. Digite APAGAR para confirmar.</p>
        <Input value={wipeText} onChange={(e) => setWipeText(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setWipeOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={wipeText !== "APAGAR"}
            onClick={async () => {
              await vault.resetEverything();
              localStorage.clear();
              location.reload();
            }}
          >
            Apagar tudo
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
