// Pequeno wrapper sobre IndexedDB. Tudo que é conteúdo do usuário entra aqui já cifrado.
import type { Encrypted } from "./crypto";

const DB_NAME = "diario-seguro";
const DB_VERSION = 1;

export type StoreName = "meta" | "entries" | "secret" | "photos";

/** Registro cifrado: o id e o ano ficam em claro para permitir indexação por volume. */
export type EncRecord = Encrypted & { id: string; year?: number };

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("meta");
      db.createObjectStore("entries", { keyPath: "id" }).createIndex("year", "year");
      db.createObjectStore("secret", { keyPath: "id" });
      db.createObjectStore("photos", { keyPath: "id" }).createIndex("year", "year");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name: StoreName, mode: IDBTransactionMode = "readonly") {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return wrap((await store("meta")).get(key)) as Promise<T | undefined>;
}

export async function setMeta(key: string, value: unknown) {
  await wrap((await store("meta", "readwrite")).put(value, key));
}

export async function delMeta(key: string) {
  await wrap((await store("meta", "readwrite")).delete(key));
}

export async function getAll(name: Exclude<StoreName, "meta">): Promise<EncRecord[]> {
  return wrap((await store(name)).getAll()) as Promise<EncRecord[]>;
}

export async function getOne(name: Exclude<StoreName, "meta">, id: string): Promise<EncRecord | undefined> {
  return wrap((await store(name)).get(id)) as Promise<EncRecord | undefined>;
}

export async function put(name: Exclude<StoreName, "meta">, rec: EncRecord) {
  await wrap((await store(name, "readwrite")).put(rec));
}

export async function del(name: Exclude<StoreName, "meta">, id: string) {
  await wrap((await store(name, "readwrite")).delete(id));
}

export async function deleteByYear(name: "entries" | "photos", year: number) {
  const s = await store(name, "readwrite");
  const keys = await wrap(s.index("year").getAllKeys(IDBKeyRange.only(year)));
  await Promise.all(keys.map((k) => wrap(s.delete(k))));
}

export async function wipeAll() {
  const db = await open();
  const tx = db.transaction(["meta", "entries", "secret", "photos"], "readwrite");
  for (const n of ["meta", "entries", "secret", "photos"] as const) tx.objectStore(n).clear();
  await new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
