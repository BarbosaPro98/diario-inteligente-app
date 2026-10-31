"use client";
import { Briefcase, Camera, CheckSquare, Flame, PenLine, Search, User } from "lucide-react";
import { useMemo, useState } from "react";
import { plainExcerpt } from "@/lib/markdown";
import { formatDate, moodOf, normalizeTag, todayISO, type Category, type Entry } from "@/lib/types";
import { Badge, Button, Card, Input, cn } from "../ui";

function streak(entries: Entry[]) {
  const days = new Set(entries.map((e) => e.date));
  let n = 0;
  const d = new Date();
  if (!days.has(todayISO())) d.setDate(d.getDate() - 1);
  for (;;) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!days.has(iso)) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function Timeline({
  entries,
  onOpen,
  onNew,
  compact,
  readOnly,
  emptyHint,
}: {
  entries: Entry[];
  onOpen: (e: Entry) => void;
  onNew: () => void;
  compact?: boolean;
  readOnly?: boolean;
  emptyHint?: string;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");

  const filtered = useMemo(() => {
    const needle = normalizeTag(q);
    return entries.filter((e) => {
      if (cat !== "all" && e.category !== cat) return false;
      if (!needle) return true;
      const hay = normalizeTag([e.title, e.body, e.tags.join(" "), e.tasks.map((t) => t.title).join(" ")].join(" "));
      return hay.includes(needle);
    });
  }, [entries, q, cat]);

  const groups = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of filtered) {
      const k = e.date.slice(0, 7);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()];
  }, [filtered]);

  const s = streak(entries);
  const tasks = entries.flatMap((e) => e.tasks);

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-28">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "Entradas", value: entries.length, icon: PenLine },
          { label: "Sequência", value: `${s} ${s === 1 ? "dia" : "dias"}`, icon: Flame },
          { label: "Tarefas", value: `${tasks.filter((t) => t.done).length}/${tasks.length}`, icon: CheckSquare },
        ].map(({ label, value, icon: I }) => (
          <Card key={label} className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <I size={14} /> {label}
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums sm:text-2xl">{value}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar em títulos, textos, tags e tarefas" className="pl-9" />
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-ui bg-surface-2 p-1 text-sm">
          {(
            [
              ["all", "Todas", null],
              ["pessoal", "Pessoal", User],
              ["estrategico", "Estratégico", Briefcase],
            ] as const
          ).map(([k, l, I]) => (
            <button
              key={k}
              onClick={() => setCat(k)}
              className={cn("flex items-center justify-center gap-1 rounded-ui px-3 py-1.5", cat === k ? "bg-surface font-medium shadow-sm" : "text-muted")}
            >
              {I && <I size={14} />}
              {l}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <PenLine className="text-muted" size={28} />
          <p className="text-muted">{q ? "Nada encontrado." : (emptyHint ?? "Nenhuma entrada ainda. Que tal escrever sobre hoje?")}</p>
          {!q && !readOnly && <Button onClick={onNew}>Escrever agora</Button>}
        </Card>
      )}

      {groups.map(([month, list]) => (
        <section key={month}>
          <h2 className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">{formatDate(month + "-01", { month: "long", year: "numeric" })}</h2>
          {compact ? (
            <Card className="divide-y divide-border overflow-hidden">
              {list.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onOpen(e)}
                  className="grid w-full grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-surface-2"
                >
                  <span className="font-mono text-xs text-muted tabular-nums">
                    {e.date.slice(8)}/{e.date.slice(5, 7)}
                  </span>
                  <span className="truncate">
                    <span className="font-medium">{e.title || "Sem título"}</span>
                    <span className="ml-2 text-muted">{plainExcerpt(e.body, 80)}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {e.tasks.length > 0 && (
                      <span className="tabular-nums">
                        {e.tasks.filter((t) => t.done).length}/{e.tasks.length}
                      </span>
                    )}
                    <Badge>{e.category === "pessoal" ? "PES" : "EST"}</Badge>
                    <span className="w-5 text-base">{moodOf(e.mood)?.emoji}</span>
                  </span>
                </button>
              ))}
            </Card>
          ) : (
            <div className="space-y-2.5">
              {list.map((e) => (
                <Card key={e.id} className="cursor-pointer p-4 transition hover:-translate-y-0.5 hover:shadow-md" onClick={() => onOpen(e)}>
                  <div className="flex items-start gap-3">
                    <div className="flex w-11 shrink-0 flex-col items-center rounded-ui bg-surface-2 py-1.5">
                      <span className="text-lg leading-none font-semibold">{e.date.slice(8)}</span>
                      <span className="text-[10px] text-muted uppercase">{formatDate(e.date, { weekday: "short" }).replace(".", "")}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold">{e.title || "Sem título"}</h3>
                        {e.mood && <span title={moodOf(e.mood)?.label}>{moodOf(e.mood)?.emoji}</span>}
                      </div>
                      {e.body && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{plainExcerpt(e.body)}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge>{e.category === "pessoal" ? "Pessoal" : "Estratégico"}</Badge>
                        {e.tags.slice(0, 4).map((t) => (
                          <Badge key={t} className="bg-primary/10 text-primary">
                            #{t}
                          </Badge>
                        ))}
                        {e.photoIds.length > 0 && (
                          <Badge>
                            <Camera size={12} /> {e.photoIds.length}
                          </Badge>
                        )}
                        {e.tasks.length > 0 && (
                          <Badge>
                            <CheckSquare size={12} /> {e.tasks.filter((t) => t.done).length}/{e.tasks.length}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
