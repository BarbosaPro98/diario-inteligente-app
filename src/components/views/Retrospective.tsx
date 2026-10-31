"use client";
import { useMemo, useState } from "react";
import { plainExcerpt } from "@/lib/markdown";
import { formatDate, MOODS, moodOf, SEALS, type Entry } from "@/lib/types";
import { Card, cn } from "../ui";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function MoodChart({ entries }: { entries: Entry[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = useMemo(
    () =>
      MONTHS.map((_, m) => {
        const list = entries.filter((e) => Number(e.date.slice(5, 7)) - 1 === m && e.mood);
        const scores = list.map((e) => moodOf(e.mood)!.score);
        const energies = list.filter((e) => e.energy).map((e) => e.energy!);
        return {
          count: list.length,
          avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
          energy: energies.length ? energies.reduce((a, b) => a + b, 0) / energies.length : null,
        };
      }),
    [entries],
  );

  const W = 640;
  const H = 240;
  const P = { l: 34, r: 12, t: 16, b: 28 };
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;
  const x = (i: number) => P.l + (iw / 12) * (i + 0.5);
  const y = (v: number) => P.t + ih - ((v - 1) / 4) * ih;
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const pts = data.map((d, i) => (d.avg === null ? null : ([x(i), y(d.avg)] as const)));

  // Linha contínua entre meses com dados (pula meses vazios sem inventar valores)
  const segments: string[] = [];
  let cur = "";
  pts.forEach((p) => {
    if (!p) {
      if (cur) segments.push(cur);
      cur = "";
      return;
    }
    cur += (cur ? " L" : "M") + `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  });
  if (cur) segments.push(cur);

  const hasData = data.some((d) => d.count);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gráfico de humor médio por mês">
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray={v === 3 ? "0" : "3 4"} />
            <text x={P.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {["😢", "😴", "😐", "🎯", "😄"][v - 1]}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
            <rect x={x(i) - iw / 24} y={P.t} width={iw / 12} height={ih} fill="transparent" />
            {d.count > 0 && (
              <rect
                x={x(i) - 9}
                y={P.t + ih - (d.count / maxCount) * ih * 0.35}
                width={18}
                height={(d.count / maxCount) * ih * 0.35}
                rx={3}
                fill="var(--accent)"
                opacity={hover === i ? 0.45 : 0.22}
              />
            )}
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={hover === i ? "var(--fg)" : "var(--muted)"}>
              {MONTHS[i]}
            </text>
          </g>
        ))}
        {segments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {pts.map(
          (p, i) =>
            p && (
              <circle
                key={i}
                cx={p[0]}
                cy={p[1]}
                r={hover === i ? 6 : 4}
                fill="var(--surface)"
                stroke="var(--primary)"
                strokeWidth={2.5}
                pointerEvents="none"
              />
            ),
        )}
      </svg>
      {!hasData && <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">Registre seu humor nas entradas para ver o gráfico.</p>}
      {hover !== null && data[hover].count > 0 && (
        <div className="bw pointer-events-none absolute top-2 right-2 rounded-ui border border-border bg-surface px-3 py-2 text-xs shadow">
          <div className="font-medium">{MONTHS[hover]}</div>
          <div>Humor médio: {data[hover].avg!.toFixed(1)} / 5</div>
          {data[hover].energy !== null && <div>Energia média: {data[hover].energy!.toFixed(1)} / 5</div>}
          <div className="text-muted">{data[hover].count} registros</div>
        </div>
      )}
    </div>
  );
}

export function Retrospective({ entries, defaultYear, onOpen }: { entries: Entry[]; defaultYear: number; onOpen: (e: Entry) => void }) {
  const years = useMemo(
    () => Array.from(new Set([defaultYear, ...entries.map((e) => Number(e.date.slice(0, 4)))])).sort((a, b) => b - a),
    [entries, defaultYear],
  );
  const [year, setYear] = useState(defaultYear);
  const list = useMemo(() => entries.filter((e) => Number(e.date.slice(0, 4)) === year), [entries, year]);

  const moodCounts = MOODS.map((m) => ({ ...m, n: list.filter((e) => e.mood === m.key).length })).filter((m) => m.n);
  const totalMood = moodCounts.reduce((a, m) => a + m.n, 0);
  const tasks = list.flatMap((e) => e.tasks);
  const focusHours = tasks.reduce((a, t) => a + t.elapsedMs, 0) / 3_600_000;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Retrospectiva {year}</h1>
          <p className="text-sm text-muted">O seu ano em conquistas, superações e memórias.</p>
        </div>
        {years.length > 1 && (
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bw h-10 rounded-ui border border-border bg-surface px-3 text-sm">
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Entradas", list.length],
          ["Dias escritos", new Set(list.map((e) => e.date)).size],
          ["Tarefas concluídas", tasks.filter((t) => t.done).length],
          ["Horas cronometradas", focusHours.toFixed(1)],
        ].map(([l, v]) => (
          <Card key={l} className="p-4">
            <div className="text-xs text-muted">{l}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{v}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Gráfico emocional anual</h2>
          <span className="flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <span className="h-0.5 w-4 bg-primary" /> humor médio
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-accent opacity-40" /> nº de registros
            </span>
          </span>
        </div>
        <MoodChart entries={list} />
        {moodCounts.length > 0 && (
          <div className="mt-4">
            <div className="flex h-3 overflow-hidden rounded-full">
              {moodCounts.map((m, i) => (
                <div
                  key={m.key}
                  title={`${m.label}: ${m.n}`}
                  style={{ width: `${(m.n / totalMood) * 100}%`, background: `color-mix(in srgb, var(--primary) ${100 - i * 10}%, var(--surface-2))` }}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {moodCounts
                .sort((a, b) => b.n - a.n)
                .map((m) => (
                  <span key={m.key}>
                    {m.emoji} {m.label} · {Math.round((m.n / totalMood) * 100)}%
                  </span>
                ))}
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {SEALS.map((s) => {
          const items = list.filter((e) => e.tags.includes(s.tag)).sort((a, b) => a.date.localeCompare(b.date));
          return (
            <Card key={s.tag} className="flex flex-col p-4">
              <h3 className="mb-1 flex items-center gap-2 font-semibold">
                <span className="text-xl">{s.emoji}</span> {s.label}
              </h3>
              <p className="mb-3 text-xs text-muted">
                Entradas com <span className="text-primary">#{s.tag}</span> · {items.length}
              </p>
              {items.length === 0 ? (
                <p className="text-sm text-muted">Marque entradas com o selo #{s.tag} para vê-las aqui.</p>
              ) : (
                <ol className="space-y-2">
                  {items.map((e) => (
                    <li key={e.id}>
                      <button onClick={() => onOpen(e)} className={cn("w-full rounded-ui p-2 text-left hover:bg-surface-2")}>
                        <div className="text-xs text-muted">{formatDate(e.date, { day: "2-digit", month: "short" })}</div>
                        <div className="text-sm font-medium">{e.title || "Sem título"}</div>
                        {e.body && <div className="line-clamp-2 text-xs text-muted">{plainExcerpt(e.body, 120)}</div>}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
