"use client";
import { ArrowLeft, Bold, CheckSquare, Eraser, Eye, Heading2, Italic, List, ListTodo, Mic, MicOff, Pause, Play, Quote, Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { renderMarkdown } from "@/lib/markdown";
import { MAX_PHOTOS_PER_DAY, MOODS, SEALS, normalizeTag, todayISO, uid, type Category, type Entry } from "@/lib/types";
import { compressImage, deletePhoto, savePhoto } from "@/lib/vault";
import { PhotoAttach } from "../Photos";
import { TaskList } from "../TaskList";
import { Badge, Button, Card, Dialog, Input, Label, Textarea, cn } from "../ui";
import { useDictation } from "../useDictation";

export type EditorProps = {
  cryptoKey: CryptoKey;
  initial: Entry | null;
  /** Todas as entradas do mesmo espaço (para o limite de fotos por dia) */
  siblings: Entry[];
  onSave: (e: Entry) => Promise<void>;
  onDelete: (e: Entry) => Promise<void>;
  onClose: () => void;
  onTaskDone: () => void;
  /** Ano do volume ativo (restringe a data). Ausente no cofre secreto. */
  year?: number;
  readOnly?: boolean;
  secret?: boolean;
};

const blank = (year?: number): Entry => {
  const today = todayISO();
  return {
    id: uid(),
    title: "",
    body: "",
    tags: [],
    category: "pessoal",
    date: year && Number(today.slice(0, 4)) !== year ? `${year}-12-31` : today,
    photoIds: [],
    tasks: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

export function EntryEditor({ cryptoKey, initial, siblings, onSave, onDelete, onClose, onTaskDone, year, readOnly, secret }: EditorProps) {
  const [entry, setEntry] = useState<Entry>(() => initial ?? blank(year));
  const [preview, setPreview] = useState(!!initial && readOnly);
  const [tagDraft, setTagDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const added = useRef<string[]>([]);
  const removed = useRef<string[]>([]);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const snapshot = useRef("");

  const set = useCallback((patch: Partial<Entry> | ((e: Entry) => Partial<Entry>)) => {
    setEntry((e) => ({ ...e, ...(typeof patch === "function" ? patch(e) : patch) }));
    setDirty(true);
  }, []);

  // ---------- Ditado ----------
  const dictation = useDictation(
    (text) =>
      set((e) => {
        const sep = e.body && !/\s$/.test(e.body) ? " " : "";
        return { body: e.body + sep + text };
      }),
    (msg) => toast.error(msg),
  );

  const startDictation = () => {
    snapshot.current = entry.body;
    dictation.start();
  };
  const clearDictation = () => {
    set({ body: snapshot.current });
    dictation.clear();
    toast("Texto ditado removido");
  };

  // ---------- Fotos (limite por dia) ----------
  const usedThatDay = useMemo(
    () => siblings.filter((s) => s.date === entry.date && s.id !== entry.id).reduce((n, s) => n + s.photoIds.length, 0),
    [siblings, entry.date, entry.id],
  );
  const remaining = Math.max(0, MAX_PHOTOS_PER_DAY - usedThatDay - entry.photoIds.length);

  const addPhotos = async (files: File[]) => {
    for (const f of files.slice(0, remaining)) {
      try {
        const id = uid();
        await savePhoto(cryptoKey, id, await compressImage(f), secret ? undefined : Number(entry.date.slice(0, 4)));
        added.current.push(id);
        set((e) => ({ photoIds: [...e.photoIds, id] }));
      } catch {
        toast.error("Não foi possível ler essa imagem");
      }
    }
    if (files.length > remaining) toast.warning(`Limite de ${MAX_PHOTOS_PER_DAY} fotos por dia`);
    else toast.success("Foto cifrada e anexada");
  };

  const removePhoto = (id: string) => {
    removed.current.push(id);
    set((e) => ({ photoIds: e.photoIds.filter((p) => p !== id) }));
  };

  // ---------- Tags ----------
  const addTag = (raw: string) => {
    const tags = raw
      .split(/[\s,]+/)
      .map(normalizeTag)
      .filter(Boolean);
    if (!tags.length) return;
    set((e) => ({ tags: Array.from(new Set([...e.tags, ...tags])) }));
    setTagDraft("");
  };

  // ---------- Formatação Markdown ----------
  const wrap = (before: string, after = before, linePrefix = false) => {
    const ta = bodyRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: en, value } = ta;
    let next: string;
    let cursor: number;
    if (linePrefix) {
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      next = value.slice(0, lineStart) + before + value.slice(lineStart);
      cursor = en + before.length;
    } else {
      next = value.slice(0, s) + before + value.slice(s, en) + after + value.slice(en);
      cursor = en + before.length;
    }
    set({ body: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(cursor, cursor);
    });
  };

  // ---------- Salvar / sair ----------
  const save = useCallback(async () => {
    if (!entry.title.trim() && !entry.body.trim() && !entry.tasks.length && !entry.photoIds.length) {
      toast.error("Escreva algo antes de salvar");
      return;
    }
    setSaving(true);
    try {
      const final = { ...entry, title: entry.title.trim(), updatedAt: Date.now() };
      await onSave(final);
      await Promise.all(removed.current.map(deletePhoto));
      added.current = [];
      removed.current = [];
      setDirty(false);
      toast.success(secret ? "Salvo no cofre secreto" : "Entrada salva e cifrada");
    } catch {
      toast.error("Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }, [entry, onSave, secret]);

  const close = useCallback(async () => {
    if (dirty && !confirm("Descartar alterações não salvas?")) return;
    await Promise.all(added.current.map(deletePhoto));
    dictation.stop();
    onClose();
  }, [dirty, dictation, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!readOnly) save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, readOnly]);

  const html = useMemo(() => renderMarkdown(entry.body), [entry.body]);
  const recording = dictation.state === "recording";

  return (
    <div className="mx-auto max-w-3xl pb-28">
      {/* Barra superior */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-2 border-b border-border bg-bg/85 px-4 py-3 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={close} aria-label="Voltar">
          <ArrowLeft size={20} />
        </Button>
        <span className="truncate text-sm text-muted">
          {initial ? "Editar entrada" : "Nova entrada"}
          {secret && " · cofre secreto"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant={preview ? "secondary" : "ghost"} size="sm" onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
            <Eye size={16} /> <span className="hidden sm:inline">Visualizar</span>
          </Button>
          {initial && !readOnly && (
            <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} aria-label="Excluir entrada" className="text-danger">
              <Trash2 size={18} />
            </Button>
          )}
          {!readOnly && (
            <Button onClick={save} disabled={saving} size="sm">
              <Save size={16} /> Salvar
            </Button>
          )}
        </div>
      </div>

      {readOnly && (
        <p className="mb-4 rounded-ui bg-surface-2 p-3 text-sm text-muted">
          O ciclo anual terminou. Faça o backup na aba Ciclo para iniciar a próxima edição; até lá as entradas ficam somente leitura.
        </p>
      )}

      <div className="space-y-5">
        {/* Categoria + data */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid grid-cols-2 gap-1 rounded-ui bg-surface-2 p-1 text-sm">
            {(
              [
                ["pessoal", "Pessoal"],
                ["estrategico", "Estratégico / Metas"],
              ] as [Category, string][]
            ).map(([k, l]) => (
              <button
                key={k}
                disabled={readOnly}
                onClick={() => set({ category: k })}
                className={cn("rounded-ui px-3 py-1.5", entry.category === k ? "bg-surface font-medium shadow-sm" : "text-muted")}
              >
                {l}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={entry.date}
            disabled={readOnly}
            min={year ? `${year}-01-01` : undefined}
            max={year ? `${year}-12-31` : undefined}
            onChange={(e) => e.target.value && set({ date: e.target.value })}
            className="bw h-10 rounded-ui border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            aria-label="Data da entrada"
          />
        </div>

        <input
          value={entry.title}
          disabled={readOnly}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Título do dia"
          className="w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-muted/60 sm:text-3xl"
        />

        {/* Corpo */}
        <Card className="overflow-hidden">
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface-2/40 p-1.5">
              {(
                [
                  [Bold, "Negrito", "**", "**", false],
                  [Italic, "Itálico", "*", "*", false],
                  [Heading2, "Título", "## ", "", true],
                  [List, "Lista", "- ", "", true],
                  [CheckSquare, "Checklist", "- [ ] ", "", true],
                  [Quote, "Citação", "> ", "", true],
                ] as const
              ).map(([I, label, before, after, line]) => (
                <Button
                  key={label}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => wrap(before, after, line)}
                  title={label}
                  aria-label={label}
                  disabled={preview}
                >
                  <I size={16} />
                </Button>
              ))}
              <div className="ml-auto flex items-center gap-1">
                {dictation.supported ? (
                  <>
                    {dictation.state !== "idle" && (
                      <span className={cn("mr-1 flex items-center gap-1.5 text-xs", recording ? "text-danger" : "text-muted")}>
                        <span className={cn("h-2 w-2 rounded-full", recording ? "animate-pulse bg-danger" : "bg-muted")} />
                        {recording ? "Gravando" : "Pausado"}
                      </span>
                    )}
                    {dictation.state === "recording" && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={dictation.pause} aria-label="Pausar ditado">
                        <Pause size={16} />
                      </Button>
                    )}
                    {dictation.state === "paused" && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={dictation.resume} aria-label="Continuar ditado">
                        <Play size={16} />
                      </Button>
                    )}
                    {(dictation.state !== "idle" || dictation.session) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={clearDictation}
                        aria-label="Limpar texto ditado"
                        title="Limpar texto ditado"
                      >
                        <Eraser size={16} />
                      </Button>
                    )}
                    <Button
                      variant={dictation.state === "idle" ? "secondary" : "danger"}
                      size="sm"
                      className={cn("h-8", recording && "recording")}
                      onClick={dictation.state === "idle" ? startDictation : dictation.stop}
                      aria-label={dictation.state === "idle" ? "Iniciar ditado por voz" : "Parar ditado"}
                    >
                      {dictation.state === "idle" ? <Mic size={16} /> : <MicOff size={16} />}
                      <span className="hidden sm:inline">{dictation.state === "idle" ? "Ditar" : "Parar"}</span>
                    </Button>
                  </>
                ) : (
                  <span className="px-2 text-xs text-muted" title="Use Chrome, Edge ou Safari para ditado">
                    Ditado indisponível neste navegador
                  </span>
                )}
              </div>
            </div>
          )}
          {preview ? (
            <div
              className="prose-diario min-h-[16rem] p-4"
              dangerouslySetInnerHTML={{ __html: html || '<p style="color:var(--muted)">Nada escrito ainda.</p>' }}
            />
          ) : (
            <Textarea
              ref={bodyRef}
              value={entry.body}
              onChange={(e) => set({ body: e.target.value })}
              placeholder="Como foi o seu dia? Use **negrito**, listas e #tags…"
              className="min-h-[16rem] resize-y rounded-none border-0 bg-transparent leading-relaxed focus:ring-0"
            />
          )}
          {dictation.interim && <p className="border-t border-border px-4 py-2 text-sm text-muted italic">{dictation.interim}…</p>}
        </Card>

        {/* Tags */}
        <section>
          <Label>Tags e selos</Label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {entry.tags.map((t) => (
              <Badge key={t} className="bg-primary/12 text-primary">
                #{t}
                {!readOnly && (
                  <button onClick={() => set((e) => ({ tags: e.tags.filter((x) => x !== t) }))} aria-label={`Remover ${t}`}>
                    <X size={12} />
                  </button>
                )}
              </Badge>
            ))}
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <Input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(tagDraft);
                  }
                }}
                onBlur={() => tagDraft && addTag(tagDraft)}
                placeholder="Adicionar tag e Enter"
                className="max-w-xs"
              />
              {SEALS.map((s) => (
                <Button
                  key={s.tag}
                  variant={entry.tags.includes(s.tag) ? "primary" : "outline"}
                  size="sm"
                  className="h-10"
                  onClick={() => set((e) => ({ tags: e.tags.includes(s.tag) ? e.tags.filter((x) => x !== s.tag) : [...e.tags, s.tag] }))}
                >
                  {s.emoji} #{s.label.split(" ")[0]}
                </Button>
              ))}
            </div>
          )}
        </section>

        {/* Tarefas */}
        <section>
          <Label className="flex items-center gap-1.5">
            <ListTodo size={14} /> Tarefas e rotinas (HH:MM:SS)
          </Label>
          <TaskList
            tasks={entry.tasks}
            readOnly={readOnly}
            onChange={(tasks) => set({ tasks })}
            onDone={() => {
              onTaskDone();
              toast.success("Tarefa concluída");
            }}
          />
          {entry.tasks.some((t) => t.runningSince) && (
            <p className="mt-1 text-xs text-muted">Cronômetro rodando. O tempo continua contando mesmo se você sair; salve para registrar.</p>
          )}
        </section>

        {/* Fotos */}
        <section>
          <Label>Cofre de fotos · até {MAX_PHOTOS_PER_DAY} por dia, cifradas no dispositivo</Label>
          <PhotoAttach cryptoKey={cryptoKey} ids={entry.photoIds} remaining={remaining} onAdd={addPhotos} onRemove={removePhoto} readOnly={readOnly} />
        </section>

        {/* Humor */}
        <section>
          <Label>Como você se sentiu hoje?</Label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-9">
            {MOODS.map((m) => (
              <button
                key={m.key}
                disabled={readOnly}
                onClick={() => set((e) => ({ mood: e.mood === m.key ? undefined : m.key }))}
                className={cn(
                  "bw flex flex-col items-center gap-1 rounded-ui border py-2 text-xs transition",
                  entry.mood === m.key ? "border-primary bg-primary/12 font-medium" : "border-border hover:bg-surface-2",
                )}
                aria-pressed={entry.mood === m.key}
              >
                <span className="text-2xl leading-none">{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm text-muted">Energia</span>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  disabled={readOnly}
                  onClick={() => set((e) => ({ energy: e.energy === n ? undefined : n }))}
                  className={cn(
                    "h-7 w-7 rounded-full text-xs font-medium transition",
                    (entry.energy ?? 0) >= n ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted",
                  )}
                  aria-label={`Energia ${n} de 5`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Excluir entrada?">
        <p className="mb-4 text-sm text-muted">A entrada e suas fotos serão apagadas deste dispositivo. Isso não pode ser desfeito.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              await onDelete(entry);
              toast.success("Entrada excluída");
              onClose();
            }}
          >
            Excluir
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
