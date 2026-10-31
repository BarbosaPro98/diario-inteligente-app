// Feedback sonoro sutil (Web Audio) e tátil (Vibration API).
let ctx: AudioContext | null = null;

function tone(freqs: number[], duration = 0.09) {
  try {
    ctx ??= new AudioContext();
    let t = ctx.currentTime;
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + duration + 0.02);
      t += duration * 0.8;
    }
  } catch {
    /* áudio indisponível */
  }
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* sem suporte */
  }
}

export type FeedbackPrefs = { sound: boolean; haptics: boolean };

export function feedback(kind: "unlock" | "save" | "task" | "error", prefs: FeedbackPrefs) {
  const map = {
    unlock: { tones: [523, 784], vib: [15, 40, 25] },
    save: { tones: [660, 880], vib: 20 },
    task: { tones: [784, 1047], vib: [10, 30, 10] },
    error: { tones: [220, 180], vib: [60, 40, 60] },
  } as const;
  const m = map[kind];
  if (prefs.sound) tone([...m.tones]);
  if (prefs.haptics) vibrate(m.vib as number | number[]);
}
