import { generateKeyBetween } from 'fractional-indexing';

export { generateKeyBetween };

/**
 * Indices (into `keys`) of a longest strictly increasing subsequence.
 * Entries that are `undefined` never take part.
 */
export function longestIncreasing(keys: (string | undefined)[]): Set<number> {
  const tails: number[] = []; // index of smallest tail for each length
  const prev = new Array<number>(keys.length).fill(-1);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k === undefined) continue;
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((keys[tails[mid]] as string) < k) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1];
    tails[lo] = i;
  }
  const keep = new Set<number>();
  let i = tails.length ? tails[tails.length - 1] : -1;
  while (i !== -1) {
    keep.add(i);
    i = prev[i];
  }
  return keep;
}

/**
 * Given sibling keys in the order the user sees them, returns the new key for
 * every index that has to change so that keys strictly increase. Keeps the
 * largest possible set of existing keys so a reorder touches few records.
 */
export function reorderKeys(keys: (string | undefined)[], canKeep?: (i: number) => boolean): Map<number, string> {
  const candidate = keys.map((k, i) => (canKeep && !canKeep(i) ? undefined : k));
  const keep = longestIncreasing(candidate);
  const out = new Map<number, string>();
  let prev: string | null = null;
  for (let i = 0; i < keys.length; i++) {
    if (keep.has(i)) {
      prev = keys[i] as string;
      continue;
    }
    let next: string | null = null;
    for (let j = i + 1; j < keys.length; j++) {
      if (keep.has(j)) {
        next = keys[j] as string;
        break;
      }
    }
    const key = jitteredKeyBetween(prev, next);
    out.set(i, key);
    prev = key;
  }
  return out;
}

/**
 * A key between `a` and `b`, nudged randomly so two devices inserting at the
 * same spot at the same time rarely produce the same key.
 */
export function jitteredKeyBetween(a: string | null, b: string | null): string {
  let lo = a;
  let hi = b;
  let key = generateKeyBetween(lo, hi);
  for (let i = 0; i < 3; i++) {
    if (Math.random() < 0.5) lo = key;
    else hi = key;
    key = generateKeyBetween(lo, hi);
  }
  return key;
}

export function comparePos(a: { pos?: string; id: string }, b: { pos?: string; id: string }): number {
  const pa = a.pos ?? '';
  const pb = b.pos ?? '';
  if (pa !== pb) return pa < pb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
