export type Category = "pessoal" | "estrategico";

export type Task = {
  id: string;
  title: string;
  /** Horário planejado no formato HH:MM:SS */
  time: string;
  done: boolean;
  /** Tempo acumulado de execução em ms */
  elapsedMs: number;
  /** Timestamp (ms) de quando o cronômetro foi iniciado, se estiver rodando */
  runningSince?: number;
};

export type Entry = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  category: Category;
  /** YYYY-MM-DD */
  date: string;
  mood?: MoodKey;
  /** 1 a 5 */
  energy?: number;
  photoIds: string[];
  tasks: Task[];
  createdAt: number;
  updatedAt: number;
};

export type MoodKey = "feliz" | "confiante" | "focado" | "calmo" | "neutro" | "cansado" | "ansioso" | "triste" | "irritado";

export const MOODS: { key: MoodKey; emoji: string; label: string; score: number }[] = [
  { key: "feliz", emoji: "😄", label: "Feliz", score: 5 },
  { key: "confiante", emoji: "😎", label: "Confiante", score: 5 },
  { key: "focado", emoji: "🎯", label: "Focado", score: 4 },
  { key: "calmo", emoji: "😌", label: "Calmo", score: 4 },
  { key: "neutro", emoji: "😐", label: "Neutro", score: 3 },
  { key: "cansado", emoji: "😴", label: "Cansado", score: 2 },
  { key: "ansioso", emoji: "😰", label: "Ansioso", score: 2 },
  { key: "triste", emoji: "😢", label: "Triste", score: 1 },
  { key: "irritado", emoji: "😠", label: "Irritado", score: 1 },
];

export const moodOf = (k?: MoodKey) => MOODS.find((m) => m.key === k);

export const THEMES = [
  { key: "dark", label: "Escuro" },
  { key: "light", label: "Claro" },
  { key: "feminino", label: "Feminino" },
  { key: "masculino", label: "Masculino" },
  { key: "infantil", label: "Infantil" },
  { key: "business", label: "Business" },
] as const;
export type ThemeKey = (typeof THEMES)[number]["key"];

export const FONTS = [
  { key: "inter", label: "Inter", group: "Profissional" },
  { key: "merriweather", label: "Merriweather", group: "Profissional" },
  { key: "playfair", label: "Playfair Display", group: "Profissional" },
  { key: "caveat", label: "Caveat", group: "Estilizada" },
  { key: "dancing", label: "Dancing Script", group: "Estilizada" },
  { key: "jetbrains", label: "JetBrains Mono", group: "Estilizada" },
] as const;
export type FontKey = (typeof FONTS)[number]["key"];

export type Settings = {
  theme: ThemeKey;
  font: FontKey;
  /** minutos de inatividade; 0 = nunca */
  autoLockMinutes: number;
  lockOnHide: boolean;
  sound: boolean;
  haptics: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  font: "inter",
  autoLockMinutes: 5,
  lockOnHide: false,
  sound: true,
  haptics: true,
};

/** Selos que alimentam a Retrospectiva */
export const SEALS = [
  { tag: "conquista", label: "Conquistas & Vitórias", emoji: "🏆" },
  { tag: "superacao", label: "Superação & Lições", emoji: "💪" },
  { tag: "inesquecivel", label: "Memórias Inesquecíveis", emoji: "✨" },
] as const;

export const normalizeTag = (t: string) => t.trim().replace(/^#/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const MAX_PHOTOS_PER_DAY = 3;

export const uid = () => crypto.randomUUID();

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const formatDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "long", year: "numeric" }) =>
  new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", opts);

export const formatDuration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
};
