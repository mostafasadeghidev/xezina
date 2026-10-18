import { latestStamp } from './crdt';
import { comparePos } from './order';
import { ROOT, ROOT_IDS, isRoot, type Kind, type Rec, type State } from './types';

export interface TreeNode {
  id: string;
  kind: Kind;
  title: string;
  url: string;
  parent: string;
  pos: string;
  rec: Rec;
  children: TreeNode[];
}

export interface Tree {
  /** Live (not deleted) nodes by id, roots included. */
  byId: Map<string, TreeNode>;
  roots: Record<string, TreeNode>;
}

const ROOT_TITLES: Record<string, string> = {
  [ROOT.toolbar]: 'Bookmarks bar',
  [ROOT.other]: 'Other bookmarks',
  [ROOT.menu]: 'Bookmarks menu',
  [ROOT.mobile]: 'Mobile bookmarks',
};

/**
 * Builds the live tree from merged state.
 *
 * - A deleted folder comes back when something inside it was edited after the
 *   deletion (so a concurrent "add to folder" is never lost).
 * - Children of a deleted folder are deleted with it.
 * - Parent cycles (two devices moving folders into each other) are broken by
 *   moving one member to "Other bookmarks".
 * - Records whose parent is unknown land in "Other bookmarks".
 */
export function buildTree(state: State): Tree {
  const recs = state;

  const parentOf = (id: string): string => {
    const p = recs[id]?.v.parent;
    if (!p || p === id) return ROOT.other;
    if (isRoot(p)) return p;
    const pr = recs[p];
    if (!pr || pr.v.kind !== 'folder') return ROOT.other;
    return p;
  };

  // 1. Revive deleted folders that received newer edits.
  const revived = new Set<string>();
  for (const id of Object.keys(recs)) {
    const r = recs[id];
    if (r.v.del || isRoot(id) || !r.v.kind) continue;
    const mine = latestStamp(r);
    let p = parentOf(id);
    const seen = new Set<string>([id]);
    while (!isRoot(p) && !seen.has(p)) {
      seen.add(p);
      const pr = recs[p];
      if (pr.v.del && !revived.has(p)) {
        if (mine > (pr.s.del ?? '')) revived.add(p);
        else break;
      }
      p = parentOf(p);
    }
  }

  const deleted = (id: string) => !!recs[id]?.v.del && !revived.has(id);

  // 2. Effective parents, with cycles broken deterministically.
  const effParent = new Map<string, string>();
  for (const id of Object.keys(recs)) {
    if (isRoot(id) || !recs[id].v.kind) continue;
    effParent.set(id, parentOf(id));
  }
  const state3 = new Map<string, 1 | 2>(); // 1 visiting, 2 done
  for (const start of effParent.keys()) {
    if (state3.get(start) === 2) continue;
    const path: string[] = [];
    let cur: string | undefined = start;
    while (cur && !isRoot(cur) && state3.get(cur) !== 2) {
      if (state3.get(cur) === 1) {
        const cycle = path.slice(path.indexOf(cur));
        const breaker = cycle.reduce((a, b) => (a < b ? a : b));
        effParent.set(breaker, ROOT.other);
        break;
      }
      state3.set(cur, 1);
      path.push(cur);
      cur = effParent.get(cur);
    }
    for (const p of path) state3.set(p, 2);
  }

  // 3. Liveness: not deleted and every ancestor alive.
  const alive = new Map<string, boolean>();
  const isAlive = (id: string): boolean => {
    if (isRoot(id)) return true;
    const known = alive.get(id);
    if (known !== undefined) return known;
    alive.set(id, false); // guards against any leftover cycle
    const ok = !deleted(id) && isAlive(effParent.get(id) ?? ROOT.other);
    alive.set(id, ok);
    return ok;
  };

  const byId = new Map<string, TreeNode>();
  const roots: Record<string, TreeNode> = {};
  for (const rid of ROOT_IDS) {
    const r = recs[rid];
    const node: TreeNode = {
      id: rid,
      kind: 'folder',
      title: ROOT_TITLES[rid],
      url: '',
      parent: '',
      pos: '',
      rec: r ?? { id: rid, v: {}, s: {} },
      children: [],
    };
    roots[rid] = node;
    byId.set(rid, node);
  }
  for (const id of effParent.keys()) {
    if (!isAlive(id)) continue;
    const r = recs[id];
    byId.set(id, {
      id,
      kind: r.v.kind as Kind,
      title: r.v.title ?? '',
      url: r.v.url ?? '',
      parent: effParent.get(id) as string,
      pos: r.v.pos ?? '',
      rec: r,
      children: [],
    });
  }
  for (const node of byId.values()) {
    if (isRoot(node.id)) continue;
    byId.get(node.parent)?.children.push(node);
  }
  for (const node of byId.values()) node.children.sort(comparePos);
  return { byId, roots };
}

/** Folder path like ["Bookmarks bar", "Work", "Tools"] for a node. */
export function pathOf(tree: Tree, id: string): string[] {
  const out: string[] = [];
  let cur = tree.byId.get(id);
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    const parent = tree.byId.get(cur.parent);
    if (!parent) break;
    out.unshift(parent.title);
    cur = parent;
  }
  return out;
}
