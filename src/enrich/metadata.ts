export interface PageInfo {
  /** HTTP status (0 = network error / timeout). */
  status: number;
  title: string;
  desc: string;
  image: string;
  finalUrl: string;
}

const MAX_BYTES = 600_000;

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? '') : '';
}

/** Extracts title, description and preview image from the <head> of a page. */
export function parseHead(html: string, baseUrl: string): Omit<PageInfo, 'status' | 'finalUrl'> {
  const head = html.slice(0, html.search(/<\/head>/i) > 0 ? html.search(/<\/head>/i) : MAX_BYTES);
  const metas: Record<string, string> = {};
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, 'property') || attr(tag, 'name') || attr(tag, 'itemprop')).toLowerCase();
    const content = attr(tag, 'content');
    if (key && content && !metas[key]) metas[key] = content.trim();
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const title = (metas['og:title'] || metas['twitter:title'] || decodeEntities(titleTag)).replace(/\s+/g, ' ').trim();
  const desc = (metas['og:description'] || metas['description'] || metas['twitter:description'] || '').replace(/\s+/g, ' ').trim();
  let image = metas['og:image'] || metas['og:image:url'] || metas['og:image:secure_url'] || metas['twitter:image'] || metas['twitter:image:src'] || '';
  if (!image) {
    // Fall back to a large touch icon.
    for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
      if (/apple-touch-icon/i.test(attr(tag, 'rel'))) {
        image = attr(tag, 'href');
        break;
      }
    }
  }
  let abs = '';
  if (image) {
    try {
      abs = new URL(image, baseUrl).href;
    } catch {
      abs = '';
    }
  }
  return { title: title.slice(0, 300), desc: desc.slice(0, 600), image: abs };
}

/** Fetches a page; a network error, timeout or server error is retried once. */
export async function fetchPage(url: string, timeout = 20_000): Promise<PageInfo> {
  const first = await fetchOnce(url, timeout);
  if (first.status !== 0 && first.status < 500) return first;
  await new Promise((r) => setTimeout(r, 3000));
  const second = await fetchOnce(url, timeout);
  return second.status !== 0 && second.status < 500 ? second : first.status ? first : second;
}

async function fetchOnce(url: string, timeout: number): Promise<PageInfo> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      credentials: 'omit',
      headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' },
    });
    const type = res.headers.get('content-type') ?? '';
    let info = { title: '', desc: '', image: '' };
    if (res.ok && /html|xml/i.test(type) && res.body) {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (size < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        size += value.length;
        const text = new TextDecoder().decode(value);
        if (/<\/head>/i.test(text)) break;
      }
      void reader.cancel().catch(() => {});
      const buf = new Uint8Array(size);
      let o = 0;
      for (const c of chunks) {
        buf.set(c, o);
        o += c.length;
      }
      const charset = type.match(/charset=([\w-]+)/i)?.[1] ?? 'utf-8';
      let html: string;
      try {
        html = new TextDecoder(charset).decode(buf);
      } catch {
        html = new TextDecoder().decode(buf);
      }
      info = parseHead(html, res.url || url);
    }
    return { status: res.status, ...info, finalUrl: res.url || url };
  } catch {
    return { status: 0, title: '', desc: '', image: '', finalUrl: url };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pages browsers never let extensions read (their own extension stores).
 * Fetching them only produces a CORS error, so they are not checked at all.
 */
export function isProtectedPage(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return (
      host === 'chromewebstore.google.com' ||
      (host === 'chrome.google.com' && u.pathname.startsWith('/webstore')) ||
      (host === 'microsoftedge.microsoft.com' && u.pathname.startsWith('/addons')) ||
      host === 'addons.mozilla.org' ||
      host === 'addons.opera.com'
    );
  } catch {
    return false;
  }
}

/** Link health from a status code. */
export function linkHealth(
  status: number | undefined,
  checkedAt: number | undefined,
  url?: string,
): 'ok' | 'broken' | 'blocked' | 'unknown' {
  if (url && isProtectedPage(url)) return 'blocked';
  if (!checkedAt) return 'unknown';
  if (status === undefined) return 'unknown';
  if (status >= 200 && status < 400) return 'ok';
  // Only the site itself saying "this page does not exist" counts as broken.
  // Timeouts, network errors (filtering, VPN off), bot protection and server
  // errors are often temporary or local, so they are "could not verify".
  if (status === 404 || status === 410) return 'broken';
  return 'blocked';
}

export type FixKind = 'moved' | 'parent' | 'root' | '';

const LOGINISH = /(log-?in|sign-?in|auth|account\/login|session)/i;

/** "The same page" for redirect purposes: scheme, www, trailing slash and case don't count. */
function samePage(a: string, b: string): boolean {
  const norm = (u: string) => {
    try {
      const x = new URL(u);
      return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '') + x.search).toLowerCase();
    } catch {
      return u;
    }
  };
  return norm(a) === norm(b);
}

/** Addresses above a URL, nearest first: /a/b/c?x → /a/b/c, /a/b/, /a/, / */
export function parentUrls(url: string): string[] {
  try {
    const u = new URL(url);
    const out: string[] = [];
    if (u.search || u.hash) out.push(u.origin + u.pathname);
    const parts = u.pathname.split('/').filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) out.push(u.origin + '/' + parts.slice(0, i).join('/') + (i ? '/' : ''));
    return [...new Set(out)].filter((x) => !samePage(x, url)).slice(0, 5);
  } catch {
    return [];
  }
}

/** The same address with a lowercase path, without the query, or with/without a trailing slash. */
export function sameShapeUrls(url: string): string[] {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const lower = path.toLowerCase();
    const flip = path.endsWith('/') ? path.replace(/\/+$/, '') : path + '/';
    const out = [
      lower !== path ? u.origin + lower + u.search : '',
      lower !== path && u.search ? u.origin + lower : '',
      u.search ? u.origin + path : '',
      path !== '/' ? u.origin + flip : '',
    ].filter(Boolean);
    return [...new Set(out)].filter((x) => x !== url);
  } catch {
    return [];
  }
}

function isRootUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.pathname === '/' || u.pathname === '') && !u.search;
  } catch {
    return false;
  }
}

/**
 * What to suggest for a bookmark after a check:
 *  - the page answered after redirecting somewhere else → "moved"
 *    (to the site's home page counts as "the page is gone, the site works")
 *  - the page is gone (404/410) → the nearest working parent address
 */
export async function findFix(url: string, info: PageInfo, fetcher = fetchPage): Promise<{ url: string; kind: FixKind }> {
  const ok = info.status >= 200 && info.status < 400;
  if (ok) {
    const final = info.finalUrl;
    if (!final || samePage(final, url) || LOGINISH.test(new URL(final).pathname)) return { url: '', kind: '' };
    if (isRootUrl(final) && !isRootUrl(url)) return { url: final, kind: 'root' };
    return { url: final, kind: 'moved' };
  }
  if (info.status !== 404 && info.status !== 410) return { url: '', kind: '' };
  // First the same page under a slightly different address (sites that
  // switched to lowercase slugs, or that reject old tracking parameters).
  for (const candidate of sameShapeUrls(url)) {
    const r = await fetcher(candidate, 10_000);
    if (r.status >= 200 && r.status < 400 && !LOGINISH.test(r.finalUrl)) {
      const target = r.finalUrl || candidate;
      if (!isRootUrl(target)) return { url: target, kind: 'moved' };
    }
  }
  for (const candidate of parentUrls(url)) {
    const r = await fetcher(candidate, 10_000);
    if (r.status >= 200 && r.status < 400 && !LOGINISH.test(r.finalUrl)) {
      const target = r.finalUrl || candidate;
      return { url: target, kind: isRootUrl(target) ? 'root' : 'parent' };
    }
  }
  return { url: '', kind: '' };
}
