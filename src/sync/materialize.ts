import { latestStamp } from '../core/crdt';
import { buildTree, type TreeNode } from '../core/tree';
import { isRoot, ROOT, ROOT_IDS, type RootId } from '../core/types';
import type { DeviceData } from './local';
import { detectRoots, flavorOf, kindOf, PROXY_TITLES, type Flavor, type NativeApi, type NativeNode } from './native';

export interface ApplyStats {
  created: number;
  updated: number;
  moved: number;
  removed: number;
  skipped: number;
}

export class MassDeleteError extends Error {
  constructor(
    readonly count: number,
    readonly total: number,
  ) {
    super(`Sync would delete ${count} of ${total} bookmarks`);
    this.name = 'MassDeleteError';
  }
}

export interface ApplyOptions {
  allowMassDelete?: boolean;
  /** Called once, right before the first change to the browser (for backups). */
  beforeChange?: () => Promise<void>;
}

interface MNode {
  id: string;
  parentId: string;
  title: string;
  url: string;
  children: string[];
}

/** Local copy of the native tree, kept in step with every API call we make. */
class Mirror {
  nodes = new Map<string, MNode>();

  constructor(tree: NativeNode[]) {
    const add = (n: NativeNode, parentId: string) => {
      this.nodes.set(n.id, {
        id: n.id,
        parentId,
        title: n.title ?? '',
        url: n.url ?? '',
        children: (n.children ?? []).map((c) => c.id),
      });
      for (const c of n.children ?? []) add(c, n.id);
    };
    for (const n of tree) add(n, '');
  }

  indexOf(id: string): number {
    const n = this.nodes.get(id);
    if (!n) return -1;
    return this.nodes.get(n.parentId)?.children.indexOf(id) ?? -1;
  }

  insert(n: NativeNode, parentId: string, index: number) {
    this.nodes.set(n.id, { id: n.id, parentId, title: n.title ?? '', url: n.url ?? '', children: [] });
    const p = this.nodes.get(parentId);
    if (p) p.children.splice(Math.min(index, p.children.length), 0, n.id);
  }

  move(id: string, parentId: string, index: number) {
    const n = this.nodes.get(id);
    if (!n) return;
    const old = this.nodes.get(n.parentId);
    if (old) old.children = old.children.filter((c) => c !== id);
    n.parentId = parentId;
    const p = this.nodes.get(parentId);
    if (p) p.children.splice(Math.min(index, p.children.length), 0, id);
  }

  removeTree(id: string) {
    const n = this.nodes.get(id);
    if (!n) return;
    const p = this.nodes.get(n.parentId);
    if (p) p.children = p.children.filter((c) => c !== id);
    const drop = (x: string) => {
      const m = this.nodes.get(x);
      if (!m) return;
      for (const c of m.children) drop(c);
      this.nodes.delete(x);
    };
    drop(id);
  }
}

function representable(node: TreeNode, flavor: Flavor): boolean {
  if (node.kind === 'separator') return flavor === 'firefox';
  if (node.kind === 'bookmark') {
    if (!node.url) return false;
    if (flavor === 'chromium' && node.url.startsWith('place:')) return false;
  }
  return true;
}

/**
 * Makes the browser's bookmarks match the merged state with as few API calls
 * as possible, then records what the browser now holds as the new shadow.
 */
export async function materialize(api: NativeApi, data: DeviceData, opts: ApplyOptions = {}): Promise<ApplyStats> {
  const stats: ApplyStats = { created: 0, updated: 0, moved: 0, removed: 0, skipped: 0 };
  const tree = buildTree(data.state);
  const nativeTree = await api.getTree();
  const flavor = flavorOf(nativeTree);
  const roots = detectRoots(nativeTree);
  const mirror = new Mirror(nativeTree);

  for (const rid of ROOT_IDS) {
    const n = roots[rid];
    if (n) data.map[rid] = n.id;
  }

  // Guard against wiping a browser because of a bad remote copy.
  const mapped = Object.keys(data.map).filter((id) => !isRoot(id) && mirror.nodes.has(data.map[id]));
  const removals = mapped.filter((id) => !tree.byId.has(id));
  if (!opts.allowMassDelete && removals.length > 20 && removals.length > mapped.length * 0.3) {
    throw new MassDeleteError(removals.length, mapped.length);
  }

  let touched = false;
  const touch = async () => {
    if (touched) return;
    touched = true;
    await opts.beforeChange?.();
  };

  const place = async (id: string, nativeFolder: string) => {
    const folder = tree.byId.get(id);
    if (!folder) return;
    let idx = 0;
    for (const node of folder.children) {
      if (!representable(node, flavor)) continue;
      const skippedAt = data.skipped[node.id];
      if (skippedAt && skippedAt >= latestStamp(node.rec)) {
        stats.skipped++;
        continue;
      }
      let nid = data.map[node.id];
      let m = nid ? mirror.nodes.get(nid) : undefined;
      if (!m) {
        await touch();
        try {
          const created = await api.create({
            parentId: nativeFolder,
            index: idx,
            title: node.kind === 'separator' ? '' : node.title,
            url: node.kind === 'bookmark' ? node.url : undefined,
            type: node.kind === 'separator' ? 'separator' : undefined,
          });
          nid = created.id;
          data.map[node.id] = nid;
          delete data.skipped[node.id];
          mirror.insert(created, nativeFolder, idx);
          m = mirror.nodes.get(nid)!;
          stats.created++;
        } catch {
          data.skipped[node.id] = latestStamp(node.rec);
          stats.skipped++;
          continue;
        }
      } else {
        const wantUrl = node.kind === 'bookmark' ? node.url : '';
        if (node.kind !== 'separator' && (m.title !== node.title || m.url !== wantUrl)) {
          await touch();
          try {
            await api.update(m.id, node.kind === 'bookmark' ? { title: node.title, url: node.url } : { title: node.title });
            m.title = node.title;
            m.url = wantUrl;
            stats.updated++;
          } catch {
            // Keep the old shadow so the next run retries.
          }
        }
        if (m.parentId !== nativeFolder || mirror.indexOf(m.id) !== idx) {
          await touch();
          await api.move(m.id, { parentId: nativeFolder, index: idx });
          mirror.move(m.id, nativeFolder, idx);
          stats.moved++;
        }
      }
      data.shadow[node.id] = { parent: id, title: m.title, url: m.url };
      idx++;
      if (node.kind === 'folder') await place(node.id, m.id);
    }
  };

  for (const rid of ROOT_IDS) {
    if (roots[rid]) await place(rid, roots[rid]!.id);
  }

  // Roots this browser lacks live in a stand-in folder under "Other bookmarks".
  for (const rid of ROOT_IDS) {
    if (roots[rid]) continue;
    const root = tree.roots[rid];
    const wanted = root.children.some((c) => representable(c, flavor));
    const proxyId = data.map[rid];
    const proxy = proxyId ? mirror.nodes.get(proxyId) : undefined;
    const otherId = roots[ROOT.other]?.id;
    if (wanted && otherId) {
      let pid = proxy?.id;
      if (!pid) {
        await touch();
        const parent = mirror.nodes.get(otherId)!;
        const created = await api.create({ parentId: otherId, title: PROXY_TITLES[rid as RootId] ?? rid });
        mirror.insert(created, otherId, parent.children.length);
        pid = created.id;
        data.map[rid] = pid;
        stats.created++;
      }
      await place(rid, pid);
    } else if (proxy && proxy.children.length === 0) {
      await touch();
      await api.removeTree(proxy.id);
      mirror.removeTree(proxy.id);
      delete data.map[rid];
    }
  }

  for (const id of removals) {
    const nid = data.map[id];
    if (nid && mirror.nodes.has(nid)) {
      await touch();
      try {
        await api.removeTree(nid);
        mirror.removeTree(nid);
        stats.removed++;
      } catch {
        continue;
      }
    }
    delete data.map[id];
    delete data.shadow[id];
  }
  // Mappings whose native node vanished along with a removed parent.
  for (const id of Object.keys(data.map)) {
    if (!mirror.nodes.has(data.map[id]) && !tree.byId.has(id)) {
      delete data.map[id];
      delete data.shadow[id];
    }
  }
  return stats;
}

/** Plain nested copy of the browser tree, used for backups and export. */
export interface PlainNode {
  title: string;
  url?: string;
  kind: 'bookmark' | 'folder' | 'separator';
  children?: PlainNode[];
}

export function plainTree(nodes: NativeNode[] | undefined): PlainNode[] {
  return (nodes ?? []).map((n) => {
    const kind = kindOf(n);
    return kind === 'folder'
      ? { title: n.title, kind, children: plainTree(n.children) }
      : { title: n.title, kind, url: n.url };
  });
}
