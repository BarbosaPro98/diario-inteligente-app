"use client";
import { BookHeart, CalendarSync, Lock, Plus, ScrollText, Settings as Cog, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { feedback } from "@/lib/feedback";
import { DEFAULT_SETTINGS, type Entry, type Settings as SettingsT } from "@/lib/types";
import * as vault from "@/lib/vault";
import { Ctx, type AppCtx, type View } from "./AppContext";
import { LockScreen } from "./LockScreen";
import { cn } from "./ui";
import { Cycle } from "./views/Cycle";
import { EntryEditor } from "./views/EntryEditor";
import { Retrospective } from "./views/Retrospective";
import { SecretVault } from "./views/SecretVault";
import { Settings } from "./views/Settings";
import { Timeline } from "./views/Timeline";

const SETTINGS_KEY = "diario-settings";

function loadSettings(): SettingsT {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const NAV: { view: View; label: string; icon: typeof Plus }[] = [
  { view: "timeline", label: "Diário", icon: ScrollText },
  { view: "retro", label: "Retrospectiva", icon: Sparkles },
  { view: "cycle", label: "Ciclo", icon: CalendarSync },
  { view: "settings", label: "Ajustes", icon: Cog },
];

export default function App() {
  const [phase, setPhase] = useState<"loading" | "setup" | "locked" | "open">("loading");
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [secretKey, setSecretKey] = useState<CryptoKey | null>(null);
  const [settings, setSettings] = useState<SettingsT>(DEFAULT_SETTINGS);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [volume, setVolume] = useState<vault.VolumeMeta>({ year: new Date().getFullYear(), startedAt: 0 });
  const [exportLog, setExportLog] = useState<vault.ExportLog>({});
  const [view, setView] = useState<View>("timeline");
  const [editingId, setEditingId] = useState<string | null>(null);
  const lastActivity = useRef(0);
  const [nowYear] = useState(() => new Date().getFullYear());
  const logoTaps = useRef<number[]>([]);

  // ---------- Inicialização ----------
  useEffect(() => {
    // Configurações vêm do localStorage, que só existe no navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadSettings());
    vault.isSetUp().then((ok) => setPhase(ok ? "locked" : "setup"));
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.dataset.font = settings.font;
    const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
  }, [settings.theme, settings.font]);

  const updateSettings = useCallback((patch: Partial<SettingsT>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const fb = useCallback((kind: "unlock" | "save" | "task" | "error") => feedback(kind, settings), [settings]);

  // ---------- Dados ----------
  const reloadEntries = useCallback(async () => {
    if (key) setEntries(await vault.loadEntries(key));
  }, [key]);

  const refreshVolume = useCallback(async () => {
    setVolume(await vault.getVolume());
    setExportLog(await vault.getExportLog());
  }, []);

  useEffect(() => {
    if (key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      reloadEntries();
      refreshVolume();
    }
  }, [key, reloadEntries, refreshVolume]);

  const lock = useCallback(() => {
    setKey(null);
    setSecretKey(null);
    setEntries([]);
    setView("timeline");
    setEditingId(null);
    setPhase("locked");
  }, []);

  const onUnlocked = useCallback(
    (k: CryptoKey) => {
      lastActivity.current = Date.now();
      setKey(k);
      setPhase("open");
      fb("unlock");
    },
    [fb],
  );

  // ---------- Auto-lock ----------
  useEffect(() => {
    if (phase !== "open") return;
    const bump = () => (lastActivity.current = Date.now());
    const evs = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"] as const;
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const iv = setInterval(() => {
      if (settings.autoLockMinutes > 0 && Date.now() - lastActivity.current > settings.autoLockMinutes * 60_000) {
        lock();
        toast("Diário bloqueado por inatividade");
      }
    }, 5000);
    const onVis = () => {
      if (document.hidden && settings.lockOnHide) lock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [phase, settings.autoLockMinutes, settings.lockOnHide, lock]);

  // ---------- Atalho discreto para o cofre secreto: Ctrl/Cmd+Shift+K ou 3 toques rápidos no logo ----------
  const openSecret = useCallback(() => {
    setEditingId(null);
    setView("secret");
  }, []);

  useEffect(() => {
    if (phase !== "open") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSecret();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, openSecret]);

  const cycleEnded = nowYear > volume.year;

  const go = useCallback((v: View, id: string | null = null) => {
    setView(v);
    setEditingId(id);
    window.scrollTo({ top: 0 });
  }, []);

  const tapLogo = useCallback(() => {
    const now = Date.now();
    logoTaps.current = [...logoTaps.current.filter((t) => now - t < 800), now];
    if (logoTaps.current.length >= 3) {
      logoTaps.current = [];
      openSecret();
    } else go("timeline");
  }, [go, openSecret]);

  const ctx = useMemo<AppCtx | null>(
    () =>
      key && {
        key,
        settings,
        updateSettings,
        entries,
        saveEntry: async (e) => {
          await vault.saveEntry(key, e);
          await reloadEntries();
          fb("save");
        },
        removeEntry: async (e) => {
          await vault.deleteEntry(key, e);
          await reloadEntries();
        },
        volume,
        exportLog,
        refreshVolume,
        reloadEntries,
        cycleEnded,
        lock,
        fb,
        view,
        go,
        editingId,
        secretKey,
        setSecretKey,
        openSecret,
      },
    [key, settings, updateSettings, entries, volume, exportLog, refreshVolume, reloadEntries, cycleEnded, lock, fb, view, go, editingId, secretKey, openSecret],
  );

  const toaster = (
    <Toaster position="top-center" richColors closeButton theme={settings.theme === "dark" || settings.theme === "masculino" ? "dark" : "light"} />
  );

  if (phase === "loading") return <div className="min-h-dvh" />;
  if (phase !== "open" || !ctx)
    return (
      <>
        <LockScreen mode={phase === "setup" ? "setup" : "unlock"} onUnlocked={onUnlocked} onError={() => fb("error")} />
        {toaster}
      </>
    );

  const editing = view === "editor" ? (editingId ? (entries.find((e) => e.id === editingId) ?? null) : null) : null;

  return (
    <Ctx.Provider value={ctx}>
      <div className="flex min-h-dvh">
        {/* Barra lateral (desktop) */}
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface/60 p-4 md:flex">
          <button onClick={tapLogo} className="mb-6 flex items-center gap-2 px-2 text-left select-none">
            <BookHeart className="text-primary" size={24} />
            <div>
              <div className="font-semibold leading-tight">Diário</div>
              <div className="text-xs text-muted">Edição {volume.year}</div>
            </div>
          </button>
          <button
            onClick={() => go("editor")}
            disabled={cycleEnded}
            className="mb-4 flex h-10 items-center justify-center gap-2 rounded-ui bg-primary text-sm font-medium text-primary-fg disabled:opacity-50"
          >
            <Plus size={18} /> Nova entrada
          </button>
          <nav className="space-y-1">
            {NAV.map(({ view: v, label, icon: I }) => (
              <button
                key={v}
                onClick={() => go(v)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-ui px-3 py-2 text-sm",
                  view === v ? "bg-surface-2 font-medium" : "text-muted hover:bg-surface-2",
                )}
              >
                <I size={18} /> {label}
              </button>
            ))}
          </nav>
          <button onClick={lock} className="mt-auto flex items-center gap-3 rounded-ui px-3 py-2 text-sm text-muted hover:bg-surface-2">
            <Lock size={18} /> Bloquear
          </button>
        </aside>

        <main className="min-w-0 flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-8 md:pt-6">
          {/* Cabeçalho (mobile) */}
          {view !== "editor" && (
            <header className="mb-4 flex items-center justify-between md:hidden">
              <button onClick={tapLogo} className="flex items-center gap-2 select-none">
                <BookHeart className="text-primary" size={22} />
                <span className="font-semibold">Diário</span>
                <span className="text-xs text-muted">· {volume.year}</span>
              </button>
              <button onClick={lock} className="rounded-ui p-2 text-muted hover:bg-surface-2" aria-label="Bloquear">
                <Lock size={18} />
              </button>
            </header>
          )}

          {cycleEnded && view === "timeline" && (
            <button onClick={() => go("cycle")} className="mx-auto mb-4 block w-full max-w-3xl rounded-ui bg-danger/10 p-3 text-left text-sm text-danger">
              A Edição {volume.year} chegou ao fim. Faça o backup para liberar a Edição {volume.year + 1}.
            </button>
          )}

          {view === "timeline" && (
            <Timeline
              entries={entries}
              onOpen={(e) => go("editor", e.id)}
              onNew={() => go("editor")}
              compact={settings.theme === "business"}
              readOnly={cycleEnded}
            />
          )}
          {view === "editor" && (
            <EntryEditor
              key={editingId ?? "new"}
              cryptoKey={key!}
              initial={editing}
              siblings={entries}
              year={volume.year}
              readOnly={cycleEnded}
              onSave={async (e) => {
                await ctx.saveEntry(e);
                if (!editingId) setEditingId(e.id);
              }}
              onDelete={ctx.removeEntry}
              onClose={() => go("timeline")}
              onTaskDone={() => fb("task")}
            />
          )}
          {view === "retro" && <Retrospective entries={entries} defaultYear={volume.year} onOpen={(e) => go("editor", e.id)} />}
          {view === "cycle" && <Cycle />}
          {view === "settings" && <Settings />}
          {view === "secret" && <SecretVault />}
        </main>

        {/* Navegação inferior (mobile) */}
        {view !== "editor" && (
          <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
            {NAV.slice(0, 2).map(({ view: v, label, icon: I }) => (
              <button
                key={v}
                onClick={() => go(v)}
                className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", view === v ? "text-primary" : "text-muted")}
              >
                <I size={20} /> {label === "Retrospectiva" ? "Retro" : label}
              </button>
            ))}
            <button
              onClick={() => go("editor")}
              disabled={cycleEnded}
              className="flex items-center justify-center disabled:opacity-50"
              aria-label="Nova entrada"
            >
              <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lg">
                <Plus size={26} />
              </span>
            </button>
            {NAV.slice(2).map(({ view: v, label, icon: I }) => (
              <button
                key={v}
                onClick={() => go(v)}
                className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", view === v ? "text-primary" : "text-muted")}
              >
                <I size={20} /> {label}
              </button>
            ))}
          </nav>
        )}
      </div>
      {toaster}
    </Ctx.Provider>
  );
}
