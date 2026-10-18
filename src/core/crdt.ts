import type { Clock } from './clock';
import type { FieldName, FieldValues, Rec, Stamp, State } from './types';

export function newRecord(id: string): Rec {
  return { id, v: {}, s: {} };
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  return false;
}

/** Writes a field locally. Returns false when the value is unchanged. */
export function setField<K extends FieldName>(
  rec: Rec,
  field: K,
  value: FieldValues[K],
  clock: Clock,
): boolean {
  if (rec.s[field] !== undefined && same(rec.v[field], value)) return false;
  rec.v[field] = value;
  rec.s[field] = clock.now();
  return true;
}

export function setFields(rec: Rec, patch: Partial<FieldValues>, clock: Clock): boolean {
  let changed = false;
  for (const key of Object.keys(patch) as FieldName[]) {
    if (setField(rec, key, patch[key] as never, clock)) changed = true;
  }
  return changed;
}

/** Newest stamp on any field of the record. */
export function latestStamp(rec: Rec): Stamp {
  let max = '';
  for (const s of Object.values(rec.s)) if (s && s > max) max = s;
  return max;
}

/**
 * Merges `incoming` into `target` field by field (last writer wins).
 * Returns true when `target` changed.
 */
export function mergeRecord(target: Rec, incoming: Rec, clock?: Clock): boolean {
  let changed = false;
  for (const key of Object.keys(incoming.s) as FieldName[]) {
    const theirs = incoming.s[key] as Stamp;
    clock?.observe(theirs);
    const ours = target.s[key];
    if (ours === undefined || theirs > ours) {
      target.v[key] = cloneValue(incoming.v[key]) as never;
      target.s[key] = theirs;
      changed = true;
    }
  }
  return changed;
}

/** Merges a whole remote state in. Returns ids of records that changed. */
export function mergeState(target: State, incoming: State, clock?: Clock): string[] {
  const changed: string[] = [];
  for (const id of Object.keys(incoming)) {
    const rec = incoming[id];
    let mine = target[id];
    if (!mine) {
      mine = target[id] = newRecord(id);
    }
    if (mergeRecord(mine, rec, clock)) changed.push(id);
  }
  return changed;
}

function cloneValue<T>(v: T): T {
  return Array.isArray(v) ? (v.slice() as T) : v;
}

export function cloneRecord(rec: Rec): Rec {
  const v: Rec['v'] = {};
  for (const [k, val] of Object.entries(rec.v)) (v as Record<string, unknown>)[k] = cloneValue(val);
  return { id: rec.id, v, s: { ...rec.s } };
}

export function cloneState(state: State): State {
  const out: State = {};
  for (const id of Object.keys(state)) out[id] = cloneRecord(state[id]);
  return out;
}
