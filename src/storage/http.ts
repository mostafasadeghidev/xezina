import { RemoteError } from './types';

export interface RequestOptions extends RequestInit {
  timeout?: number;
  /** Statuses that are returned instead of thrown (e.g. 404). */
  allow?: number[];
}

export async function request(url: string, opts: RequestOptions = {}): Promise<Response> {
  const { timeout = 60_000, allow = [], ...init } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', ...init, signal: ctrl.signal });
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? 'Request timed out' : 'Network error — check the address and your connection';
    throw new RemoteError(msg, 0);
  } finally {
    clearTimeout(timer);
  }
  if (res.ok || allow.includes(res.status)) return res;
  let detail = '';
  try {
    detail = (await res.text()).slice(0, 300);
  } catch {
    // ignore
  }
  throw new RemoteError(describe(res.status, detail), res.status);
}

function describe(status: number, detail: string): string {
  const hint =
    status === 401
      ? 'Wrong username, password or token'
      : status === 403
        ? 'Access denied — check the token permissions'
        : status === 404
          ? 'Not found — check the address'
          : status === 429
            ? 'Too many requests — try again later'
            : status >= 500
              ? 'The server had a problem'
              : 'Request failed';
  const clean = detail.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return `${hint} (HTTP ${status})${clean ? ': ' + clean.slice(0, 160) : ''}`;
}

export async function bytesOf(res: Response): Promise<Uint8Array> {
  return new Uint8Array(await res.arrayBuffer());
}

export function joinPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .join('/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/|\/$/g, '');
}

export function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

/** Values of an XML tag regardless of namespace prefix. */
export function xmlValues(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

export function xmlValue(xml: string, tag: string): string {
  return xmlValues(xml, tag)[0] ?? '';
}

export function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

export function basicAuth(user: string, pass: string): string {
  const bytes = new TextEncoder().encode(`${user}:${pass}`);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return 'Basic ' + btoa(s);
}
