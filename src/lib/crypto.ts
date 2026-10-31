// Criptografia local com Web Crypto API.
// Modelo: uma chave de dados (DEK) AES-GCM 256 aleatória cifra todo o conteúdo.
// A DEK é "embrulhada" por uma chave derivada da senha (PBKDF2-SHA256) e,
// opcionalmente, por uma chave derivada da extensão PRF do WebAuthn (biometria).

const PBKDF2_ITERATIONS = 310_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export type Encrypted = { iv: string; ct: string };
export type WrappedKey = { salt: string; iv: string; ct: string; iterations: number };

export function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n));
}

async function deriveKek(secret: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function kekFromBytes(bytes: Uint8Array<ArrayBuffer>) {
  // HKDF sobre o segredo PRF para obter uma chave AES.
  const base = await crypto.subtle.importKey("raw", bytes, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("diario-prf"), info: enc.encode("kek") },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

async function wrapWith(kek: CryptoKey, dek: CryptoKey, salt: Uint8Array, iterations: number): Promise<WrappedKey> {
  const raw = await crypto.subtle.exportKey("raw", dek);
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, kek, raw);
  return { salt: toB64(salt), iv: toB64(iv), ct: toB64(ct), iterations };
}

async function unwrapWith(kek: CryptoKey, w: WrappedKey): Promise<CryptoKey> {
  const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(w.iv) }, kek, fromB64(w.ct));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

export async function wrapKeyWithPassword(dek: CryptoKey, password: string): Promise<WrappedKey> {
  const salt = randomBytes(16);
  const kek = await deriveKek(password, salt, PBKDF2_ITERATIONS);
  return wrapWith(kek, dek, salt, PBKDF2_ITERATIONS);
}

/** Lança erro se a senha estiver incorreta (falha de autenticação do GCM). */
export async function unwrapKeyWithPassword(w: WrappedKey, password: string): Promise<CryptoKey> {
  const kek = await deriveKek(password, fromB64(w.salt), w.iterations);
  return unwrapWith(kek, w);
}

export async function wrapKeyWithSecret(dek: CryptoKey, secret: Uint8Array<ArrayBuffer>): Promise<WrappedKey> {
  return wrapWith(await kekFromBytes(secret), dek, new Uint8Array(0), 0);
}

export async function unwrapKeyWithSecret(w: WrappedKey, secret: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return unwrapWith(await kekFromBytes(secret), w);
}

export async function encryptBytes(key: CryptoKey, data: Uint8Array<ArrayBuffer>): Promise<Encrypted> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { iv: toB64(iv), ct: toB64(ct) };
}

export async function decryptBytes(key: CryptoKey, e: Encrypted): Promise<Uint8Array<ArrayBuffer>> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(e.iv) }, key, fromB64(e.ct));
  return new Uint8Array(pt);
}

export async function encryptJSON(key: CryptoKey, value: unknown): Promise<Encrypted> {
  return encryptBytes(key, enc.encode(JSON.stringify(value)));
}

export async function decryptJSON<T>(key: CryptoKey, e: Encrypted): Promise<T> {
  return JSON.parse(dec.decode(await decryptBytes(key, e))) as T;
}

/** Arquivo de backup autocontido: cifrado com chave derivada de uma senha. */
export async function encryptWithPassword(password: string, value: unknown) {
  const salt = randomBytes(16);
  const key = await deriveKek(password, salt, PBKDF2_ITERATIONS);
  const e = await encryptBytes(key, enc.encode(JSON.stringify(value)));
  return { salt: toB64(salt), iterations: PBKDF2_ITERATIONS, ...e };
}

export async function decryptWithPassword<T>(password: string, file: { salt: string; iterations: number; iv: string; ct: string }): Promise<T> {
  const key = await deriveKek(password, fromB64(file.salt), file.iterations);
  return JSON.parse(dec.decode(await decryptBytes(key, file))) as T;
}
