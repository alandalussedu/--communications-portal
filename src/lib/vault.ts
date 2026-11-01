/**
 * Encryption for the protected part of the platform (indicators, remedial
 * plans and everything around them).
 *
 * - One random 256-bit data key encrypts every protected document with
 *   AES-GCM. The document path is bound in as additional data, so an
 *   encrypted document cannot be moved to another id.
 * - The data key is stored in `vault/main` locked with a key derived from the
 *   password (PBKDF2-SHA256). Changing the password re-locks the key only.
 * - Nothing here leaves the browser: the password and the opened key live in
 *   memory for the visit.
 *
 * The same format is produced by the scheduled tasks (Node WebCrypto), so the
 * two sides must stay byte-compatible.
 */

export type EncBox = { v: 1; iv: string; ct: string }
export type VaultDoc = {
  v: 1
  kdf: "PBKDF2-SHA256"
  iter: number
  salt: string
  iv: string
  wrapped: string
  keyId: string
  updatedAt: string
}

export const KDF_ITER = 600_000
const enc = new TextEncoder()
const dec = new TextDecoder()

export function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ""
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}

export function fromB64(s: string): Uint8Array {
  const bin = atob(s)
  const u = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
  return u
}

export function cryptoAvailable(): boolean {
  return typeof crypto !== "undefined" && !!crypto.subtle && typeof crypto.getRandomValues === "function"
}

/** Short fingerprint of a raw key, used to check that the right key was opened. */
export async function keyIdOf(raw: Uint8Array): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", raw))
  return Array.from(h.subarray(0, 8), (b) => b.toString(16).padStart(2, "0")).join("")
}

async function deriveKek(password: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(password.normalize("NFC")), "PBKDF2", false, ["deriveKey"])
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
}

export function importDataKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"])
}

/** Locks a raw data key with a password. */
export async function wrapKey(raw: Uint8Array, password: string): Promise<VaultDoc> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const kek = await deriveKek(password, salt, KDF_ITER)
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode("vault/main") }, kek, raw)
  return { v: 1, kdf: "PBKDF2-SHA256", iter: KDF_ITER, salt: toB64(salt), iv: toB64(iv), wrapped: toB64(ct), keyId: await keyIdOf(raw), updatedAt: new Date().toISOString() }
}

/** Opens the data key; null when the password is wrong. */
export async function unwrapKey(v: VaultDoc, password: string): Promise<Uint8Array | null> {
  try {
    const kek = await deriveKek(password, fromB64(v.salt), v.iter)
    const raw = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(v.iv), additionalData: enc.encode("vault/main") }, kek, fromB64(v.wrapped)))
    if ((await keyIdOf(raw)) !== v.keyId) return null
    return raw
  } catch {
    return null
  }
}

export function isEncrypted(row: unknown): row is { id: string; enc: EncBox } {
  const e = (row as { enc?: Partial<EncBox> } | null)?.enc
  return !!e && e.v === 1 && typeof e.iv === "string" && typeof e.ct === "string"
}

export async function encryptDoc(key: CryptoKey, collection: string, id: string, doc: Record<string, unknown>): Promise<{ enc: EncBox }> {
  const { id: _drop, ...body } = doc
  void _drop
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(`${collection}/${id}`) }, key, enc.encode(JSON.stringify(body)))
  return { enc: { v: 1, iv: toB64(iv), ct: toB64(ct) } }
}

export async function decryptDoc(key: CryptoKey, collection: string, id: string, box: EncBox): Promise<Record<string, unknown>> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(box.iv), additionalData: enc.encode(`${collection}/${id}`) }, key, fromB64(box.ct))
  return { ...(JSON.parse(dec.decode(pt)) as Record<string, unknown>), id }
}

/** A rough strength check shown while choosing a password. */
export function passwordIssues(pw: string): string[] {
  const out: string[] = []
  if (pw.length < 12) out.push("12 حرفًا على الأقل")
  if (/^(.)\1+$/.test(pw)) out.push("لا تكرّر حرفًا واحدًا")
  if (/^\d+$/.test(pw)) out.push("لا تجعلها أرقامًا فقط")
  return out
}
