import type { Clock } from '../core/clock';
import { cloneRecord, setField } from '../core/crdt';
import { generateKeyBetween } from '../core/order';
import { buildTree } from '../core/tree';
import { ROOT_IDS, type FieldName, type State } from '../core/types';
import type { DeviceData } from './local';

const META_FIELDS: FieldName[] = ['notes', 'tags', 'fav', 'label', 'desc', 'siteTitle', 'img', 'imgSrc', 'status', 'checkedAt', 'fixUrl', 'fixKind'];

function empty(v: unknown): boolean {
  return v === undefined || v === '' || v === false || v === 0 || (Array.isArray(v) && v.length === 0);
}

/**
 * First contact between this browser and a remote copy: bookmarks that both
 * sides already have (same folder + same URL, or same folder name) are
 * matched and adopt the remote id instead of being duplicated. Notes and tags
 * written locally survive the match. Local-only items are appended after the
 * remote items of the same folder.
 *
 * Returns the number of matched records. Call before merging `remote` in.
 */
export function join(data: DeviceData, remote: State, clock: Clock): number {
  const local = buildTree(data.state);
  const theirs = buildTree(remote);
  const rename = new Map<string, string>();
  const appendAfter = new Map<string, { after: string; ids: string[] }>();

  const match = (lid: string, rid: string) => {
    const lf = local.byId.get(lid);
    const rf = theirs.byId.get(rid);
    if (!lf || !rf) return;
    const used = new Set<string>();
    const unmatched: string[] = [];
    for (const l of lf.children) {
      if (remote[l.id]) {
        used.add(l.id);
        if (l.kind === 'folder') match(l.id, l.id);
        continue;
      }
      const r = rf.children.find(
        (c) =>
          !used.has(c.id) &&
          !data.state[c.id] &&
          c.kind === l.kind &&
          (l.kind === 'bookmark' ? c.url === l.url : l.kind === 'folder' ? c.title === l.title : false),
      );
      if (!r) {
        unmatched.push(l.id);
        continue;
      }
      used.add(r.id);
      rename.set(l.id, r.id);
      if (l.kind === 'folder') match(l.id, r.id);
    }
    if (unmatched.length) {
      const last = rf.children[rf.children.length - 1];
      appendAfter.set(rid, { after: last?.pos ?? '', ids: unmatched });
    }
  };

  for (const rid of ROOT_IDS) match(rid, rid);

  const target = (id: string) => rename.get(id) ?? id;

  for (const [lid, rid] of rename) {
    const mine = data.state[lid];
    const rec = cloneRecord(remote[rid]);
    data.state[rid] = rec;
    for (const f of META_FIELDS) {
      if (!empty(mine.v[f]) && empty(rec.v[f])) setField(rec, f, mine.v[f] as never, clock);
    }
    delete data.state[lid];
    if (data.map[lid]) {
      data.map[rid] = data.map[lid];
      delete data.map[lid];
    }
    if (data.shadow[lid]) {
      data.shadow[rid] = data.shadow[lid];
      delete data.shadow[lid];
    }
  }

  // Point children and shadows at renamed parents.
  for (const rec of Object.values(data.state)) {
    if (rec.v.parent && rename.has(rec.v.parent) && !remote[rec.id]) rec.v.parent = target(rec.v.parent);
  }
  for (const sh of Object.values(data.shadow)) sh.parent = target(sh.parent);

  for (const [rid, { after, ids }] of appendAfter) {
    let prev: string | null = after || null;
    for (const id of ids) {
      const rec = data.state[id];
      if (!rec) continue;
      const key = generateKeyBetween(prev, null);
      setField(rec, 'parent', rid, clock);
      setField(rec, 'pos', key, clock);
      prev = key;
    }
  }

  return rename.size;
}
