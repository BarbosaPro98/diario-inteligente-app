"use client";
import { BookOpen, CheckCircle2, FileJson, FileText, Loader2, RefreshCw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { exportJson, exportPdf, importJson } from "@/lib/export";
import { markExported, startNextVolume } from "@/lib/vault";
import { useApp } from "../AppContext";
import { Button, Card, Dialog, Input, cn } from "../ui";

function Step({ done, n, title, children }: { done: boolean; n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          done ? "bg-success text-white" : "bg-surface-2 text-muted",
        )}
      >
        {done ? <CheckCircle2 size={16} /> : n}
      </div>
      <div className="flex-1 pb-4">
        <div className="font-medium">{title}</div>
        {children}
      </div>
    </div>
  );
}

export function Cycle() {
  const app = useApp();
  const { volume, exportLog, entries, key, cycleEnded } = app;
  const [busy, setBusy] = useState<"pdf" | "json" | "import" | "next" | null>(null);
  const [pwDialog, setPwDialog] = useState<"export" | "import" | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [nextOpen, setNextOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const importText = useRef("");

  const year = volume.year;
  const yearEntries = entries.filter((e) => Number(e.date.slice(0, 4)) === year);
  const log = exportLog[year] ?? {};
  const now = new Date();
  const start = new Date(year, 0, 1);
  const dayOfYear = now.getFullYear() > year ? 365 : Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1;
  const daysInYear = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
  const progress = Math.min(1, dayOfYear / daysInYear);
  const ready = !!log.pdf && !!log.json;

  const doPdf = async () => {
    setBusy("pdf");
    try {
      await exportPdf(key, yearEntries, year);
      await markExported(year, "pdf");
      await app.refreshVolume();
      toast.success("PDF da edição gerado");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar o PDF");
    } finally {
      setBusy(null);
    }
  };

  const doJson = async () => {
    if (pw.length < 6) return toast.error("Use uma senha de pelo menos 6 caracteres");
    if (pw !== pw2) return toast.error("As senhas não conferem");
    setPwDialog(null);
    setBusy("json");
    try {
      await exportJson(key, yearEntries, year, pw);
      await markExported(year, "json");
      await app.refreshVolume();
      toast.success("Backup cifrado baixado");
    } catch {
      toast.error("Falha ao exportar");
    } finally {
      setBusy(null);
      setPw("");
      setPw2("");
    }
  };

  const doImport = async () => {
    setPwDialog(null);
    setBusy("import");
    try {
      const n = await importJson(key, importText.current, pw);
      await app.reloadEntries();
      toast.success(`${n} entradas restauradas`);
    } catch {
      toast.error("Senha incorreta ou arquivo inválido");
    } finally {
      setBusy(null);
      setPw("");
    }
  };

  const doNext = async () => {
    setBusy("next");
    try {
      const next = await startNextVolume(year);
      await app.reloadEntries();
      await app.refreshVolume();
      setNextOpen(false);
      setConfirmText("");
      toast.success(`Edição ${next} iniciada`);
      app.fb("save");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-28">
      <Card className="overflow-hidden">
        <div className="bg-primary p-6 text-primary-fg">
          <div className="flex items-center gap-2 text-sm opacity-80">
            <BookOpen size={16} /> Volume atual
          </div>
          <div className="mt-1 text-3xl font-semibold">Edição {year}</div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-primary-fg/20">
            <div className="h-full bg-primary-fg/80" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs opacity-80">
            <span>
              Dia {Math.min(dayOfYear, daysInYear)} de {daysInYear}
            </span>
            <span>{yearEntries.length} entradas</span>
          </div>
        </div>
        {cycleEnded && (
          <div className="border-b border-border bg-danger/10 p-4 text-sm">
            <strong>O ciclo de {year} terminou.</strong> Para abrir a edição {year + 1}, baixe o livro em PDF e o backup JSON cifrado. Depois disso o volume
            antigo é apagado deste dispositivo.
          </div>
        )}
        <div className="p-5">
          <Step n={1} done={!!log.pdf} title="Livro em PDF">
            <p className="mb-2 text-sm text-muted">Todas as entradas do ano formatadas como livro, com capa, capítulos por mês e fotos.</p>
            <Button variant="outline" size="sm" onClick={doPdf} disabled={!!busy}>
              {busy === "pdf" ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />} Baixar PDF
            </Button>
            {log.pdf && <span className="ml-2 text-xs text-muted">baixado em {new Date(log.pdf).toLocaleString("pt-BR")}</span>}
          </Step>
          <Step n={2} done={!!log.json} title="Backup JSON cifrado">
            <p className="mb-2 text-sm text-muted">
              Arquivo completo (texto, tarefas, humor e fotos) protegido por uma senha de backup. Serve para restaurar o diário.
            </p>
            <Button variant="outline" size="sm" onClick={() => setPwDialog("export")} disabled={!!busy}>
              {busy === "json" ? <Loader2 className="animate-spin" size={16} /> : <FileJson size={16} />} Baixar backup
            </Button>
            {log.json && <span className="ml-2 text-xs text-muted">baixado em {new Date(log.json).toLocaleString("pt-BR")}</span>}
          </Step>
          <Step n={3} done={false} title="Próximo ciclo">
            <p className="mb-2 text-sm text-muted">
              {cycleEnded
                ? ready
                  ? "Tudo pronto. Você já pode iniciar a nova edição."
                  : "Liberado depois dos dois downloads acima."
                : `Disponível a partir de 1º de janeiro de ${year + 1}.`}
            </p>
            <Button size="sm" onClick={() => setNextOpen(true)} disabled={!cycleEnded || !ready || !!busy}>
              <RefreshCw size={16} /> Iniciar Edição {year + 1}
            </Button>
          </Step>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Restaurar backup</h2>
        <p className="mt-1 mb-3 text-sm text-muted">
          Importe um arquivo .backup.json para reabrir uma edição anterior ou trazer o diário para outro dispositivo.
        </p>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={!!busy}>
          {busy === "import" ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />} Escolher arquivo
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            importText.current = await f.text();
            setPwDialog("import");
          }}
        />
      </Card>

      <Dialog open={pwDialog !== null} onClose={() => setPwDialog(null)} title={pwDialog === "export" ? "Senha do backup" : "Abrir backup"}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (pwDialog === "export") doJson();
            else doImport();
          }}
        >
          <p className="text-sm text-muted">
            {pwDialog === "export"
              ? "Sem esta senha o arquivo não pode ser aberto por ninguém, nem por você. Guarde-a com cuidado."
              : "Digite a senha usada ao exportar este backup."}
          </p>
          <Input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Senha do backup" />
          {pwDialog === "export" && <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repita a senha" />}
          <Button type="submit" className="w-full" disabled={!pw}>
            {pwDialog === "export" ? "Cifrar e baixar" : "Restaurar"}
          </Button>
        </form>
      </Dialog>

      <Dialog open={nextOpen} onClose={() => setNextOpen(false)} title={`Encerrar a Edição ${year}?`}>
        <p className="mb-3 text-sm text-muted">
          As {yearEntries.length} entradas e fotos de {year} serão apagadas deste dispositivo. Elas continuam no PDF e no backup que você baixou. O cofre
          secreto não é afetado.
        </p>
        <p className="mb-2 text-sm">
          Digite <strong>{year}</strong> para confirmar:
        </p>
        <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} inputMode="numeric" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setNextOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={doNext} disabled={confirmText !== String(year) || busy === "next"}>
            Iniciar Edição {year + 1}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
