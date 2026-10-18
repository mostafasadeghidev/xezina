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

export async function fetchPage(url: string, timeout = 15_000): Promise<PageInfo> {
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

/** Link health from a status code. */
export function linkHealth(status: number | undefined, checkedAt: number | undefined): 'ok' | 'broken' | 'blocked' | 'unknown' {
  if (!checkedAt) return 'unknown';
  if (status === undefined) return 'unknown';
  if (status >= 200 && status < 400) return 'ok';
  if (status === 0 || status === 404 || status === 410 || (status >= 500 && status !== 503)) return 'broken';
  return 'blocked';
}
