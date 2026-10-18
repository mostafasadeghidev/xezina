import type { Clock } from '../core/clock';
import { newRecord, setField, setFields } from '../core/crdt';
import { reorderKeys } from '../core/order';
import { isRoot, ROOT_IDS, type Rec } from '../core/types';
import { newId, type DeviceData } from './local';
import { detectRoots, kindOf, type NativeNode } from './native';

export interface ScanResult {
  /** Ids of records changed by local edits. */
  changed: Set<string>;
}

/**
 * Compares the browser's bookmarks with what this device last saw and turns
 * every difference into stamped field writes on the records.
 */
export function scan(tree: NativeNode[], data: DeviceData, clock: Clock): ScanResult {
  const changed = new Set<string>();
  const roots = detectRoots(tree);
  const byNative = new Map<string, string>();
  for (const [id, nid] of Object.entries(data.map)) byNative.set(nid, id);

  for (const rid of ROOT_IDS) {
    const n = roots[rid];
    if (n) {
      const prev = data.map[rid];
      if (prev && prev !== n.id) byNative.delete(prev);
      data.map[rid] = n.id;
      byNative.set(n.id, rid);
    }
  }

  const seen = new Set<string>();

  const recOf = (id: string): Rec => {
    let r = data.state[id];
    if (!r) r = data.state[id] = newRecord(id);
    return r;
  };

  const walk = (folder: NativeNode, folderId: string) => {
    const list: string[] = [];
    const needsPos = new Set<string>();
    for (const child of folder.children ?? []) {
      if (child.unmodifiable) continue;
      let id = byNative.get(child.id);
      if (id && isRoot(id)) {
        // Stand-in folder for a root this browser lacks.
        seen.add(id);
        walk(child, id);
        continue;
      }
      const kind = kindOf(child);
      const title = child.title ?? '';
      const url = kind === 'bookmark' ? (child.url ?? '') : '';
      if (!id) {
        id = newId();
        data.map[id] = child.id;
        byNative.set(child.id, id);
        const rec = recOf(id);
        setFields(rec, { kind, parent: folderId, title, url, addedAt: child.dateAdded ?? Date.now() }, clock);
        if (rec.v.del) setField(rec, 'del', false, clock);
        needsPos.add(id);
        changed.add(id);
      } else {
        const rec = recOf(id);
        const sh = data.shadow[id];
        let dirty = false;
        if (!sh) {
          dirty = setFields(rec, { kind, parent: folderId, title, url }, clock);
          needsPos.add(id);
        } else {
          if (sh.title !== title) dirty = setField(rec, 'title', title, clock) || dirty;
          if (sh.url !== url) dirty = setField(rec, 'url', url, clock) || dirty;
          if (sh.parent !== folderId) {
            dirty = setField(rec, 'parent', folderId, clock) || dirty;
            needsPos.add(id);
          }
        }
        if (!rec.v.kind) dirty = setField(rec, 'kind', kind, clock) || dirty;
        // Edited here while deleted elsewhere: the edit brings it back.
        if (dirty && rec.v.del) setField(rec, 'del', false, clock);
        if (dirty) changed.add(id);
      }
      data.shadow[id] = { parent: folderId, title, url };
      seen.add(id);
      list.push(id);
      if (kind === 'folder') walk(child, id);
    }
    // Order: keep as many existing keys as possible, re-key the rest.
    const keys = list.map((id) => data.state[id].v.pos);
    const updates = reorderKeys(keys, (i) => !needsPos.has(list[i]));
    for (const [i, key] of updates) {
      const rec = data.state[list[i]];
      if (setField(rec, 'pos', key, clock)) changed.add(rec.id);
    }
  };

  for (const rid of ROOT_IDS) {
    const n = roots[rid];
    if (!n) continue;
    seen.add(rid);
    walk(n, rid);
  }

  // Whatever we mirrored before and is gone now was deleted by the user.
  for (const id of Object.keys(data.map)) {
    if (seen.has(id)) continue;
    if (isRoot(id)) {
      // A stand-in root folder disappeared; its children are handled below.
      delete data.map[id];
      continue;
    }
    if (data.skipped[id]) continue;
    const rec = data.state[id];
    if (rec && !rec.v.del && data.shadow[id]) {
      setField(rec, 'del', true, clock);
      changed.add(id);
    }
    delete data.map[id];
    delete data.shadow[id];
  }

  return { changed };
}
