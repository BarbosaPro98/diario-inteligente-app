// Exportação do volume anual: PDF em formato de livro e backup JSON cifrado.
import { jsPDF } from "jspdf";
import { decryptWithPassword, encryptWithPassword, fromB64, toB64 } from "./crypto";
import { formatDate, formatDuration, moodOf, type Entry } from "./types";
import { loadPhoto, saveEntry, savePhoto } from "./vault";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// As fontes padrão do PDF cobrem Latin-1; emojis e outros símbolos são removidos.
const latin1 = (s: string) => s.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "").replace(/ {2,}/g, " ");
const stripMd = (s: string) =>
  s
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*]\s+\[( |x)\]\s+/gim, (_m, c) => (c.trim() ? "[x] " : "[ ] "))
    .replace(/^\s*[-*]\s+/gm, "- ")
    .replace(/^>\s?(.*)$/gm, "\"$1\"");

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportPdf(key: CryptoKey, entries: Entry[], year: number, author = "") {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  const lineH = 5.2;
  let y = M;
  let page = 1;

  const footer = () => {
    doc.setFont("times", "italic");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Edição ${year}`, M, H - 8);
    doc.text(String(page), W - M, H - 8, { align: "right" });
    doc.setTextColor(30);
  };
  const newPage = () => {
    footer();
    doc.addPage();
    page++;
    y = M;
  };
  const ensure = (h: number) => {
    if (y + h > H - 16) newPage();
  };

  // Capa
  doc.setFillColor(28, 30, 38);
  doc.rect(0, 0, W, H, "F");
  doc.setTextColor(240);
  doc.setFont("times", "normal");
  doc.setFontSize(12);
  doc.text("DIÁRIO PESSOAL & ESTRATÉGICO", W / 2, H / 2 - 22, { align: "center" });
  doc.setFont("times", "bold");
  doc.setFontSize(34);
  doc.text(`Edição ${year}`, W / 2, H / 2, { align: "center" });
  doc.setFont("times", "italic");
  doc.setFontSize(11);
  doc.text(`${entries.length} entradas`, W / 2, H / 2 + 12, { align: "center" });
  if (author) doc.text(latin1(author), W / 2, H - 30, { align: "center" });
  doc.addPage();
  page++;
  doc.setTextColor(30);

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  let currentMonth = -1;

  for (const e of sorted) {
    const month = Number(e.date.slice(5, 7)) - 1;
    if (month !== currentMonth) {
      if (currentMonth !== -1) newPage();
      currentMonth = month;
      y = H / 3;
      doc.setFont("times", "bold");
      doc.setFontSize(26);
      doc.text(MONTHS[month], W / 2, y, { align: "center" });
      doc.setDrawColor(180);
      doc.line(W / 2 - 15, y + 5, W / 2 + 15, y + 5);
      newPage();
    }

    ensure(24);
    doc.setFont("times", "italic");
    doc.setFontSize(9);
    doc.setTextColor(110);
    const mood = moodOf(e.mood);
    const meta = [
      formatDate(e.date, { weekday: "long", day: "2-digit", month: "long" }),
      e.category === "pessoal" ? "Pessoal" : "Estratégico",
      mood ? `Humor: ${mood.label}` : "",
      e.energy ? `Energia ${e.energy}/5` : "",
    ]
      .filter(Boolean)
      .join("  ·  ");
    doc.text(latin1(meta), M, y);
    y += 6;
    doc.setTextColor(30);
    doc.setFont("times", "bold");
    doc.setFontSize(15);
    for (const l of doc.splitTextToSize(latin1(e.title || "Sem título"), W - 2 * M)) {
      ensure(7);
      doc.text(l, M, y);
      y += 6.5;
    }
    y += 1;

    doc.setFont("times", "normal");
    doc.setFontSize(10.5);
    for (const para of latin1(stripMd(e.body)).split("\n")) {
      const lines = para.trim() ? doc.splitTextToSize(para, W - 2 * M) : [""];
      for (const l of lines) {
        ensure(lineH);
        doc.text(l, M, y);
        y += lineH;
      }
    }

    if (e.tasks.length) {
      y += 2;
      doc.setFont("times", "bold");
      doc.setFontSize(10);
      ensure(lineH);
      doc.text("Tarefas", M, y);
      y += lineH;
      doc.setFont("times", "normal");
      for (const t of e.tasks) {
        ensure(lineH);
        doc.text(latin1(`${t.done ? "[x]" : "[ ]"} ${t.time}  ${t.title}  (${formatDuration(t.elapsedMs)})`), M + 2, y);
        y += lineH;
      }
    }

    for (const pid of e.photoIds) {
      const bytes = await loadPhoto(key, pid);
      if (!bytes) continue;
      const dataUrl = "data:image/jpeg;base64," + toB64(bytes);
      const props = doc.getImageProperties(dataUrl);
      const w = W - 2 * M;
      let h = (props.height / props.width) * w;
      const maxH = H * 0.45;
      const fw = h > maxH ? (maxH / h) * w : w;
      h = Math.min(h, maxH);
      ensure(h + 4);
      y += 2;
      doc.addImage(dataUrl, "JPEG", M + (w - fw) / 2, y, fw, h);
      y += h + 2;
    }

    if (e.tags.length) {
      doc.setFont("times", "italic");
      doc.setFontSize(9);
      doc.setTextColor(110);
      ensure(lineH);
      doc.text(latin1(e.tags.map((t) => "#" + t).join("  ")), M, y + 1);
      doc.setTextColor(30);
      y += lineH;
    }

    y += 4;
    ensure(6);
    doc.setDrawColor(210);
    doc.line(W / 2 - 6, y, W / 2 + 6, y);
    y += 8;
  }
  footer();
  download(doc.output("blob"), `diario-edicao-${year}.pdf`);
}

type BackupPayload = {
  app: "diario-seguro";
  version: 1;
  year: number;
  exportedAt: number;
  entries: Entry[];
  photos: Record<string, string>;
};

export async function exportJson(key: CryptoKey, entries: Entry[], year: number, password: string) {
  const photos: Record<string, string> = {};
  for (const e of entries)
    for (const pid of e.photoIds) {
      const b = await loadPhoto(key, pid);
      if (b) photos[pid] = toB64(b);
    }
  const payload: BackupPayload = { app: "diario-seguro", version: 1, year, exportedAt: Date.now(), entries, photos };
  const file = { format: "diario-seguro-backup", version: 1, year, ...(await encryptWithPassword(password, payload)) };
  download(new Blob([JSON.stringify(file)], { type: "application/json" }), `diario-edicao-${year}.backup.json`);
}

/** Restaura um backup no armazenamento atual. Devolve quantas entradas foram importadas. */
export async function importJson(key: CryptoKey, text: string, password: string): Promise<number> {
  const file = JSON.parse(text);
  if (file.format !== "diario-seguro-backup") throw new Error("Arquivo não reconhecido");
  const payload = await decryptWithPassword<BackupPayload>(password, file);
  for (const [id, b64] of Object.entries(payload.photos)) {
    const owner = payload.entries.find((e) => e.photoIds.includes(id));
    await savePhoto(key, id, fromB64(b64), owner ? Number(owner.date.slice(0, 4)) : undefined);
  }
  for (const e of payload.entries) await saveEntry(key, e);
  return payload.entries.length;
}
