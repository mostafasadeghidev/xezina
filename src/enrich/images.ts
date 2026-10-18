import { sha256Hex } from '../sync/codec';

const MAX_W = 560;
const MAX_H = 360;

/** Downscales an image to a small preview (WebP when the browser can encode it). */
export async function makePreview(input: Blob, crop = false): Promise<Blob> {
  const bitmap = await createImageBitmap(input);
  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (crop) {
    // Screenshots: keep the top of the page at a 16:10 ratio.
    sh = Math.min(sh, Math.round(sw / 1.6));
  }
  const scale = Math.min(1, MAX_W / sw, MAX_H / sh);
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
  bitmap.close();
  let out = await canvas.convertToBlob({ type: 'image/webp', quality: 0.78 });
  if (out.type !== 'image/webp') out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  return out;
}

export async function hashBlob(blob: Blob): Promise<string> {
  return sha256Hex(new Uint8Array(await blob.arrayBuffer()));
}

export async function downloadImage(url: string, timeout = 15_000): Promise<Blob | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'omit' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    if (type && !type.startsWith('image/')) return null;
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > 8_000_000) return null;
    return await res.blob();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',');
  const type = head.match(/data:([^;]+)/)?.[1] ?? 'image/png';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
