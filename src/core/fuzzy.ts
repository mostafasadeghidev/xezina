import { foldText } from './normalize';

/**
 * Typo- and spacing-tolerant matching in the spirit of editor "fuzzy find":
 * the letters of the query must appear in order; separators (spaces, dots,
 * dashes) are ignored; contiguous runs and word starts score higher.
 *
 *   "checkhost", "chechost", "che host"  →  "check-host.net"
 */

const WORD = /[\p{L}\p{N}]/u;

/** Folded letters/digits of a string, with a map back to the original indices. */
export interface Prepared {
  text: string;
  /** Original index of each char of `text`. */
  map: number[];
  /** True where a char starts a word in the original. */
  start: boolean[];
}

const foldCache = new Map<string, string>();
function foldChar(c: string): string {
  let f = foldCache.get(c);
  if (f === undefined) {
    f = foldText(c)[0] ?? '';
    foldCache.set(c, f);
  }
  return f;
}

export function prepare(original: string): Prepared {
  const text: string[] = [];
  const map: number[] = [];
  const start: boolean[] = [];
  let prevWord = false;
  let prevLower = false;
  for (let i = 0; i < original.length; i++) {
    const c = original[i];
    const f = foldChar(c);
    if (!f || !WORD.test(f)) {
      // Joiners (ZWNJ, combining marks) vanish without breaking the word.
      if (f === '' && prevWord) continue;
      prevWord = false;
      prevLower = false;
      continue;
    }
    const upper = c !== c.toLowerCase();
    text.push(f);
    map.push(i);
    // A word starts after a separator, or at a camelCase hump ("GitHub").
    start.push(!prevWord || (upper && prevLower));
    prevWord = true;
    prevLower = !upper && c !== c.toUpperCase();
  }
  return { text: text.join(''), map, start };
}

/** Folded query split into words, each reduced to letters/digits. */
export function queryWords(query: string): string[] {
  return foldText(query)
    .split(/\s+/)
    .map((w) => [...w].filter((c) => WORD.test(c)).join(''))
    .filter(Boolean);
}

export interface FuzzyHit {
  score: number;
  /** Indices into `prepared.text`. */
  positions: number[];
}

/** Matches an already folded, separator-free pattern against a prepared string. */
export function fuzzyMatch(pattern: string, p: Prepared): FuzzyHit | null {
  const n = pattern.length;
  if (!n || n > p.text.length) return null;

  // 1. Contiguous: best occurrence, preferring one at a word start.
  let best = -1;
  let from = 0;
  for (;;) {
    const at = p.text.indexOf(pattern, from);
    if (at < 0) break;
    if (best < 0 || (p.start[at] && !p.start[best])) best = at;
    if (p.start[at]) break;
    from = at + 1;
  }
  if (best >= 0) {
    const positions = Array.from({ length: n }, (_, k) => best + k);
    const score = 100 + n * 16 + (p.start[best] ? 40 : 0) + (best === 0 ? 20 : 0) + Math.round((20 * n) / p.text.length);
    return { score, positions };
  }

  // 2. In order with gaps (needs at least 3 letters, or it matches everything).
  if (n < 3) return null;
  const positions: number[] = [];
  let j = 0;
  for (let i = 0; i < p.text.length && j < n; i++) {
    if (p.text[i] === pattern[j]) {
      positions.push(i);
      j++;
    }
  }
  if (j < n) return null;
  // Tighten: walk back from the end to pull earlier letters as late as possible.
  for (let k = n - 2; k >= 0; k--) {
    for (let i = positions[k + 1] - 1; i > positions[k]; i--) {
      if (p.text[i] === pattern[k]) {
        positions[k] = i;
        break;
      }
    }
  }
  const span = positions[n - 1] - positions[0] + 1;
  if (span > n * 3 + 3) return null; // too scattered to be what was meant
  let score = 0;
  for (let k = 0; k < n; k++) {
    score += 8;
    if (k > 0 && positions[k] === positions[k - 1] + 1) score += 10;
    if (p.start[positions[k]]) score += 8;
  }
  score -= (span - n) * 4;
  return score > 0 ? { score, positions } : null;
}

/** Original-string ranges [start, end) to highlight for a query. */
export function highlightRanges(original: string, query: string): [number, number][] {
  const words = queryWords(query);
  if (!words.length || !original) return [];
  const p = prepare(original);
  const marked = new Set<number>();
  const whole = fuzzyMatch(words.join(''), p);
  if (whole && words.length > 1) whole.positions.forEach((i) => marked.add(p.map[i]));
  else {
    for (const w of words) fuzzyMatch(w, p)?.positions.forEach((i) => marked.add(p.map[i]));
    if (!marked.size && whole) whole.positions.forEach((i) => marked.add(p.map[i]));
  }
  const idx = [...marked].sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (const i of idx) {
    const last = out[out.length - 1];
    // Join ranges separated only by invisible joiners (ZWNJ, diacritics).
    const gapInvisible = last && [...original.slice(last[1], i)].every((c) => foldChar(c) === '');
    if (last && gapInvisible) last[1] = i + 1;
    else out.push([i, i + 1]);
  }
  return out;
}
