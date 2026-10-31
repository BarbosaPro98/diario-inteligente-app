"use client";
import { Check, Pause, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDuration, uid, type Task } from "@/lib/types";
import { Button, Input, cn } from "./ui";

const nowHMS = () => new Date().toTimeString().slice(0, 8);

export const taskElapsed = (t: Task, now = Date.now()) => t.elapsedMs + (t.runningSince ? now - t.runningSince : 0);

export function TaskList({ tasks, onChange, onDone, readOnly }: { tasks: Task[]; onChange: (t: Task[]) => void; onDone: () => void; readOnly?: boolean }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState(nowHMS);
  const [, setTick] = useState(0);
  const anyRunning = tasks.some((t) => t.runningSince);

  useEffect(() => {
    if (!anyRunning) return;
    const i = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, [anyRunning]);

  const update = (id: string, patch: (t: Task) => Partial<Task>) => onChange(tasks.map((t) => (t.id === id ? { ...t, ...patch(t) } : t)));

  const add = () => {
    if (!title.trim()) return;
    onChange([...tasks, { id: uid(), title: title.trim(), time: time.length === 5 ? time + ":00" : time, done: false, elapsedMs: 0 }]);
    setTitle("");
    setTime(nowHMS());
  };

  const toggleTimer = (t: Task) =>
    update(t.id, (x) => (x.runningSince ? { elapsedMs: taskElapsed(x), runningSince: undefined } : { runningSince: Date.now() }));

  const toggleDone = (t: Task) => {
    if (!t.done) onDone();
    update(t.id, (x) => ({ done: !x.done, elapsedMs: taskElapsed(x), runningSince: undefined }));
  };

  const sorted = [...tasks].sort((a, b) => a.time.localeCompare(b.time));
  const done = tasks.filter((t) => t.done).length;

  return (
    <div className="space-y-2">
      {tasks.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-success transition-all" style={{ width: `${(done / tasks.length) * 100}%` }} />
          </div>
          {done}/{tasks.length} concluídas
        </div>
      )}
      <ul className="space-y-1.5">
        {sorted.map((t) => (
          <li key={t.id} className={cn("bw flex items-center gap-2 rounded-ui border border-border bg-surface-2/50 p-2", t.done && "opacity-60")}>
            <button
              onClick={() => !readOnly && toggleDone(t)}
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                t.done ? "border-success bg-success text-white" : "border-muted",
              )}
              aria-label={t.done ? "Marcar como pendente" : "Concluir tarefa"}
            >
              {t.done && <Check size={14} strokeWidth={3} />}
            </button>
            <input
              type="time"
              step={1}
              value={t.time}
              disabled={readOnly}
              onChange={(e) => update(t.id, () => ({ time: e.target.value.length === 5 ? e.target.value + ":00" : e.target.value }))}
              className="w-[6.8rem] shrink-0 bg-transparent font-mono text-xs text-muted tabular-nums outline-none"
              aria-label="Horário"
            />
            <span className={cn("min-w-0 flex-1 truncate text-sm", t.done && "line-through")}>{t.title}</span>
            <span className={cn("font-mono text-xs tabular-nums", t.runningSince ? "text-primary" : "text-muted")}>{formatDuration(taskElapsed(t))}</span>
            {!readOnly && (
              <>
                {!t.done && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => toggleTimer(t)}
                    aria-label={t.runningSince ? "Pausar cronômetro" : "Iniciar cronômetro"}
                  >
                    {t.runningSince ? <Pause size={15} /> : <Play size={15} />}
                  </Button>
                )}
                {taskElapsed(t) > 0 && !t.runningSince && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => update(t.id, () => ({ elapsedMs: 0 }))} aria-label="Zerar cronômetro">
                    <RotateCcw size={14} />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted"
                  onClick={() => onChange(tasks.filter((x) => x.id !== t.id))}
                  aria-label="Remover tarefa"
                >
                  <Trash2 size={14} />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <div className="flex gap-2">
          <input
            type="time"
            step={1}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="bw h-10 w-[7.5rem] shrink-0 rounded-ui border border-border bg-surface px-2 font-mono text-sm tabular-nums outline-none focus:border-primary"
            aria-label="Horário da nova tarefa (HH:MM:SS)"
          />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
            placeholder="Nova tarefa ou rotina"
          />
          <Button size="icon" variant="secondary" onClick={add} aria-label="Adicionar tarefa">
            <Plus size={18} />
          </Button>
        </div>
      )}
    </div>
  );
}
