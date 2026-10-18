/**
 * File format for everything Xezina stores remotely:
 *   "XZ1" + flag byte + payload
 * flag 'g' = gzip(JSON), flag 'e' = 12-byte IV + AES-GCM(gzip(JSON)).
 */

const MAGIC = [0x58, 0x5a, 0x31]; // "XZ1"
const FLAG_PLAIN = 0x67; // g
const FLAG_ENC = 0x65; // e

export const PBKDF2_ITERATIONS = 600_000;

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([data as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export const gzip = (d: Uint8Array) => pipe(d, new CompressionStream('gzip'));
export const gunzip = (d: Uint8Array) => pipe(d, new DecompressionStream('gzip'));

export async function deriveKey(passphrase: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function exportKey(key: CryptoKey): Promise<string> {
  return toBase64(new Uint8Array(await crypto.subtle.exportKey('raw', key)));
}

export async function importKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromBase64(b64) as BufferSource, 'AES-GCM', true, ['encrypt', 'decrypt']);
}

export async function encodeBytes(raw: Uint8Array, key?: CryptoKey | null): Promise<Uint8Array> {
  const packed = await gzip(raw);
  if (!key) return concat(new Uint8Array([...MAGIC, FLAG_PLAIN]), packed);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, packed as BufferSource));
  return concat(new Uint8Array([...MAGIC, FLAG_ENC]), iv, sealed);
}

export class NeedsKeyError extends Error {
  constructor() {
    super('This data is encrypted; enter the sync passphrase.');
    this.name = 'NeedsKeyError';
  }
}

export async function decodeBytes(data: Uint8Array, key?: CryptoKey | null): Promise<Uint8Array> {
  if (data.length < 4 || data[0] !== MAGIC[0] || data[1] !== MAGIC[1] || data[2] !== MAGIC[2]) {
    throw new Error('Unknown file format');
  }
  const body = data.subarray(4);
  if (data[3] === FLAG_PLAIN) return gunzip(body);
  if (data[3] !== FLAG_ENC) throw new Error('Unknown file format');
  if (!key) throw new NeedsKeyError();
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: body.subarray(0, 12) as BufferSource },
      key,
      body.subarray(12) as BufferSource,
    );
  } catch {
    throw new Error('Wrong sync passphrase');
  }
  return gunzip(new Uint8Array(plain));
}

export async function encodeJson(value: unknown, key?: CryptoKey | null): Promise<Uint8Array> {
  return encodeBytes(new TextEncoder().encode(JSON.stringify(value)), key);
}

export async function decodeJson<T>(data: Uint8Array, key?: CryptoKey | null): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await decodeBytes(data, key))) as T;
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
  return [...hash].map((b) => b.toString(16).padStart(2, '0')).join('');
}
