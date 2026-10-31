"use client";
import { createContext, useContext } from "react";
import type { Entry, Settings } from "@/lib/types";
import type { ExportLog, VolumeMeta } from "@/lib/vault";

export type View = "timeline" | "editor" | "retro" | "cycle" | "settings" | "secret";

export type AppCtx = {
  key: CryptoKey;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  entries: Entry[];
  saveEntry: (e: Entry) => Promise<void>;
  removeEntry: (e: Entry) => Promise<void>;
  volume: VolumeMeta;
  exportLog: ExportLog;
  refreshVolume: () => Promise<void>;
  reloadEntries: () => Promise<void>;
  /** O ciclo anual terminou e o volume ainda não foi renovado */
  cycleEnded: boolean;
  lock: () => void;
  fb: (kind: "unlock" | "save" | "task" | "error") => void;
  view: View;
  go: (v: View, editingId?: string | null) => void;
  editingId: string | null;
  secretKey: CryptoKey | null;
  setSecretKey: (k: CryptoKey | null) => void;
  openSecret: () => void;
};

export const Ctx = createContext<AppCtx | null>(null);

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp fora do provider");
  return c;
}
