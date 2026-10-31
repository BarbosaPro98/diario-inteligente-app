// Operações de alto nível: configurar/desbloquear chaves e ler/gravar conteúdo cifrado.
import * as db from "./db";
import {
  decryptBytes,
  decryptJSON,
  encryptBytes,
  encryptJSON,
  generateDataKey,
  unwrapKeyWithPassword,
  unwrapKeyWithSecret,
  wrapKeyWithPassword,
  wrapKeyWithSecret,
  type WrappedKey,
} from "./crypto";
import type { Entry } from "./types";
import { getBiometricSecret, registerBiometric, type BioConfig } from "./webauthn";

type MasterMeta = { wrapped: WrappedKey; kind: "pin" | "password"; createdAt: number };
type BioMeta = BioConfig & { wrapped: WrappedKey };
export type VolumeMeta = { year: number; startedAt: number };
export type ExportLog = Record<number, { pdf?: number; json?: number }>;

// ---------- Tranca master ----------
export const isSetUp = async () => !!(await db.getMeta<MasterMeta>("master"));
export const masterKind = async () => (await db.getMeta<MasterMeta>("master"))?.kind ?? "pin";

export async function setupMaster(secret: string, kind: "pin" | "password"): Promise<CryptoKey> {
  const dek = await generateDataKey();
  await db.setMeta("master", { wrapped: await wrapKeyWithPassword(dek, secret), kind, createdAt: Date.now() } satisfies MasterMeta);
  await db.setMeta("volume", { year: new Date().getFullYear(), startedAt: Date.now() } satisfies VolumeMeta);
  return dek;
}

export async function unlockWithSecret(secret: string): Promise<CryptoKey> {
  const m = await db.getMeta<MasterMeta>("master");
  if (!m) throw new Error("Diário não configurado");
  return unwrapKeyWithPassword(m.wrapped, secret);
}

export async function changeMaster(key: CryptoKey, secret: string, kind: "pin" | "password") {
  const m = await db.getMeta<MasterMeta>("master");
  await db.setMeta("master", { ...m!, wrapped: await wrapKeyWithPassword(key, secret), kind });
}

export const hasBiometric = async () => !!(await db.getMeta<BioMeta>("bio"));

export async function enableBiometric(key: CryptoKey) {
  const { config, secret } = await registerBiometric();
  await db.setMeta("bio", { ...config, wrapped: await wrapKeyWithSecret(key, secret) } satisfies BioMeta);
}

export const disableBiometric = () => db.delMeta("bio");

export async function unlockWithBiometric(): Promise<CryptoKey> {
  const b = await db.getMeta<BioMeta>("bio");
  if (!b) throw new Error("Biometria não configurada");
  return unwrapKeyWithSecret(b.wrapped, await getBiometricSecret(b));
}

// ---------- Cofre secreto ----------
export const hasSecretVault = async () => !!(await db.getMeta("secretVault"));

export async function setupSecretVault(password: string): Promise<CryptoKey> {
  const k = await generateDataKey();
  await db.setMeta("secretVault", { wrapped: await wrapKeyWithPassword(k, password) });
  return k;
}

export async function unlockSecretVault(password: string): Promise<CryptoKey> {
  const m = await db.getMeta<{ wrapped: WrappedKey }>("secretVault");
  if (!m) throw new Error("Cofre não configurado");
  return unwrapKeyWithPassword(m.wrapped, password);
}

// ---------- Entradas ----------
type EntryStore = "entries" | "secret";

export async function loadEntries(key: CryptoKey, storeName: EntryStore = "entries"): Promise<Entry[]> {
  const recs = await db.getAll(storeName);
  const out: Entry[] = [];
  for (const r of recs) {
    try {
      out.push(await decryptJSON<Entry>(key, r));
    } catch {
      // registro corrompido ou de outra chave: ignorado
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export async function saveEntry(key: CryptoKey, entry: Entry, storeName: EntryStore = "entries") {
  const e = await encryptJSON(key, entry);
  await db.put(storeName, { id: entry.id, year: storeName === "entries" ? Number(entry.date.slice(0, 4)) : undefined, ...e });
}

export async function deleteEntry(key: CryptoKey, entry: Entry, storeName: EntryStore = "entries") {
  await Promise.all(entry.photoIds.map((p) => db.del("photos", p)));
  await db.del(storeName, entry.id);
}

// ---------- Fotos ----------
/** Redimensiona para no máximo 1600px e converte em JPEG antes de cifrar. */
export async function compressImage(file: File, max = 1600): Promise<Uint8Array<ArrayBuffer>> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const g = canvas.getContext("2d")!;
  // JPEG não tem transparência: fundo branco para PNGs.
  g.fillStyle = "#fff";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.85));
  return new Uint8Array(await blob.arrayBuffer());
}

export async function savePhoto(key: CryptoKey, id: string, bytes: Uint8Array<ArrayBuffer>, year?: number) {
  await db.put("photos", { id, year, ...(await encryptBytes(key, bytes)) });
}

export async function loadPhoto(key: CryptoKey, id: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const r = await db.getOne("photos", id);
  if (!r) return null;
  try {
    return await decryptBytes(key, r);
  } catch {
    return null;
  }
}

export const deletePhoto = (id: string) => db.del("photos", id);

// ---------- Volume anual ----------
export async function getVolume(): Promise<VolumeMeta> {
  return (await db.getMeta<VolumeMeta>("volume")) ?? { year: new Date().getFullYear(), startedAt: Date.now() };
}

export async function getExportLog(): Promise<ExportLog> {
  return (await db.getMeta<ExportLog>("exports")) ?? {};
}

export async function markExported(year: number, kind: "pdf" | "json") {
  const log = await getExportLog();
  log[year] = { ...log[year], [kind]: Date.now() };
  await db.setMeta("exports", log);
}

/** Apaga as entradas/fotos do volume encerrado e abre o volume seguinte. */
export async function startNextVolume(currentYear: number) {
  await db.deleteByYear("entries", currentYear);
  await db.deleteByYear("photos", currentYear);
  const next = Math.max(currentYear + 1, new Date().getFullYear());
  await db.setMeta("volume", { year: next, startedAt: Date.now() } satisfies VolumeMeta);
  return next;
}

export const resetEverything = () => db.wipeAll();
