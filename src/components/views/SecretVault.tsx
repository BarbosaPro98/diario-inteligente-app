"use client";
import { EyeOff, Lock, ShieldEllipsis } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Entry } from "@/lib/types";
import * as vault from "@/lib/vault";
import { useApp } from "../AppContext";
import { Button, Card, Input } from "../ui";
import { EntryEditor } from "./EntryEditor";
import { Timeline } from "./Timeline";

/** Cofre secreto: segunda senha, chave própria, armazenamento separado e fora da busca/timeline. */
export function SecretVault() {
  const app = useApp();
  const { secretKey, setSecretKey } = app;
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editing, setEditing] = useState<Entry | "new" | null>(null);

  useEffect(() => {
    vault.hasSecretVault().then(setConfigured);
  }, []);

  const load = useCallback(async (k: CryptoKey) => setEntries(await vault.loadEntries(k, "secret")), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (secretKey) load(secretKey);
  }, [secretKey, load]);

  const submit = async () => {
    setBusy(true);
    try {
      if (!configured) {
        if (pw.length < 6) throw new Error("Use pelo menos 6 caracteres");
        if (pw !== pw2) throw new Error("As senhas não conferem");
        setSecretKey(await vault.setupSecretVault(pw));
        setConfigured(true);
        toast.success("Cofre secreto criado");
      } else {
        setSecretKey(await vault.unlockSecretVault(pw));
      }
      app.fb("unlock");
    } catch (e) {
      app.fb("error");
      toast.error(e instanceof Error && e.message && !e.name.includes("Operation") ? e.message : "Senha incorreta");
    } finally {
      setBusy(false);
      setPw("");
      setPw2("");
    }
  };

  if (!secretKey) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-sm p-6">
          <div className="mb-5 flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2">
              <ShieldEllipsis size={24} />
            </div>
            <h1 className="text-lg font-semibold">{configured ? "Cofre secreto" : "Criar cofre secreto"}</h1>
            <p className="mt-1 text-sm text-muted">
              {configured ? "Digite a segunda senha." : "Uma camada isolada, com senha própria. As entradas daqui não aparecem na timeline nem na busca."}
            </p>
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Senha do cofre" autoComplete="off" />
            {!configured && <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repita a senha" autoComplete="off" />}
            <Button type="submit" className="w-full" disabled={!pw || busy || configured === null}>
              <Lock size={16} /> {configured ? "Abrir" : "Criar cofre"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => app.go("timeline")}>
              Voltar
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  if (editing) {
    return (
      <EntryEditor
        secret
        cryptoKey={secretKey}
        initial={editing === "new" ? null : editing}
        siblings={entries}
        onSave={async (e) => {
          await vault.saveEntry(secretKey, e, "secret");
          await load(secretKey);
          app.fb("save");
        }}
        onDelete={async (e) => {
          await vault.deleteEntry(secretKey, e, "secret");
          await load(secretKey);
        }}
        onClose={() => setEditing(null)}
        onTaskDone={() => app.fb("task")}
      />
    );
  }

  return (
    <div>
      <div className="mx-auto mb-4 flex max-w-3xl items-center gap-2">
        <EyeOff size={18} className="text-muted" />
        <h1 className="font-semibold">Cofre secreto</h1>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSecretKey(null);
              app.go("timeline");
            }}
          >
            <Lock size={14} /> Trancar cofre
          </Button>
          <Button size="sm" onClick={() => setEditing("new")}>
            Nova entrada secreta
          </Button>
        </div>
      </div>
      <Timeline
        entries={entries}
        onOpen={setEditing}
        onNew={() => setEditing("new")}
        emptyHint="O cofre está vazio."
        compact={app.settings.theme === "business"}
      />
    </div>
  );
}
