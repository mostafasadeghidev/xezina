const TRACKING = /^(utm_\w+|fbclid|gclid|yclid|mc_cid|mc_eid|ref|ref_src|igshid|si)$/i;

/** Canonical form used to find duplicates and match a tab to a bookmark. */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return raw.trim();
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const params = [...u.searchParams.entries()]
      .filter(([k]) => !TRACKING.test(k))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const query = params.length ? '?' + new URLSearchParams(params).toString() : '';
    let path = u.pathname.replace(/\/+$/, '');
    if (path === '') path = '';
    const port = u.port && u.port !== '80' && u.port !== '443' ? ':' + u.port : '';
    return `${host}${port}${path}${query}`;
  } catch {
    return raw.trim();
  }
}

export function hostOf(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/**
 * Folds text for search: lower case, no diacritics, Arabic → Persian letters,
 * ZWNJ removed, Persian/Arabic digits → Latin.
 */
export function foldText(s: string): string {
  let out = s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ًͯ-ٰٟ]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ةۀ]/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/[‌‍‎‏]/g, '')
    .replace(/ـ/g, '');
  out = out.replace(/[۰-۹٠-٩]/g, (d) => {
    const i = PERSIAN_DIGITS.indexOf(d);
    return String(i >= 0 ? i : ARABIC_DIGITS.indexOf(d));
  });
  return out;
}

/** Tag cleanup: trimmed, no leading '#', collapsed spaces, folded case. */
export function cleanTag(tag: string): string {
  return tag.trim().replace(/^#+/, '').replace(/\s+/g, ' ').toLowerCase();
}

export function uniqueTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const t of tags.map(cleanTag)) if (t && !out.includes(t)) out.push(t);
  return out;
}
