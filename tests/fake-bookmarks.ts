import type { CreateDetails, Flavor, NativeApi, NativeNode } from '../src/sync/native';
import { kindOf } from '../src/sync/native';

interface Node {
  id: string;
  parentId: string;
  title: string;
  url?: string;
  type?: 'separator';
  children?: string[];
  dateAdded: number;
}

/**
 * In-memory bookmarks with the same shape and quirks as the real APIs:
 * Chrome's built-in folders "1", "2", "3"; Firefox's "toolbar_____" etc.,
 * and Chrome's off-by-one when moving down inside the same folder.
 */
export class FakeBookmarks implements NativeApi {
  nodes = new Map<string, Node>();
  private n = 100;
  calls = 0;

  constructor(readonly flavor: Flavor) {
    if (flavor === 'chromium') {
      this.add({ id: '0', parentId: '', title: '', children: [] });
      this.add({ id: '1', parentId: '0', title: 'Bookmarks bar', children: [] });
      this.add({ id: '2', parentId: '0', title: 'Other bookmarks', children: [] });
      this.add({ id: '3', parentId: '0', title: 'Mobile bookmarks', children: [] });
    } else {
      this.add({ id: 'root________', parentId: '', title: '', children: [] });
      this.add({ id: 'menu________', parentId: 'root________', title: 'Bookmarks Menu', children: [] });
      this.add({ id: 'toolbar_____', parentId: 'root________', title: 'Bookmarks Toolbar', children: [] });
      this.add({ id: 'unfiled_____', parentId: 'root________', title: 'Other Bookmarks', children: [] });
      this.add({ id: 'mobile______', parentId: 'root________', title: 'Mobile Bookmarks', children: [] });
    }
  }

  get toolbar() {
    return this.flavor === 'chromium' ? '1' : 'toolbar_____';
  }
  get other() {
    return this.flavor === 'chromium' ? '2' : 'unfiled_____';
  }

  private add(n: Omit<Node, 'dateAdded'>) {
    const node = { ...n, dateAdded: 1 };
    this.nodes.set(n.id, node);
    if (n.parentId) this.nodes.get(n.parentId)!.children!.push(n.id);
  }

  private view(id: string): NativeNode {
    const n = this.nodes.get(id)!;
    const parent = this.nodes.get(n.parentId);
    const out: NativeNode = {
      id: n.id,
      parentId: n.parentId || undefined,
      index: parent ? parent.children!.indexOf(id) : undefined,
      title: n.title,
      dateAdded: n.dateAdded,
    };
    if (n.url !== undefined) out.url = n.url;
    if (this.flavor === 'firefox') out.type = n.type ?? (n.url !== undefined ? 'bookmark' : 'folder');
    if (n.children) out.children = n.children.map((c) => this.view(c));
    return out;
  }

  async getTree() {
    return [this.view(this.flavor === 'chromium' ? '0' : 'root________')];
  }

  async create(d: CreateDetails) {
    this.calls++;
    const parent = this.nodes.get(d.parentId);
    if (!parent?.children) throw new Error('bad parent');
    if (this.flavor === 'firefox' && d.url?.startsWith('chrome://')) throw new Error('Invalid URL');
    const id = String(++this.n);
    const isSep = d.type === 'separator' && this.flavor === 'firefox';
    const node: Node = {
      id,
      parentId: d.parentId,
      title: isSep ? '' : (d.title ?? ''),
      url: isSep ? undefined : d.url,
      type: isSep ? 'separator' : undefined,
      children: d.url === undefined && !isSep ? [] : undefined,
      dateAdded: Date.now(),
    };
    this.nodes.set(id, node);
    const idx = d.index === undefined ? parent.children.length : Math.min(d.index, parent.children.length);
    parent.children.splice(idx, 0, id);
    return this.view(id);
  }

  async update(id: string, c: { title?: string; url?: string }) {
    this.calls++;
    const n = this.nodes.get(id)!;
    if (c.title !== undefined) n.title = c.title;
    if (c.url !== undefined) n.url = c.url;
    return this.view(id);
  }

  async move(id: string, dest: { parentId: string; index?: number }) {
    this.calls++;
    const n = this.nodes.get(id)!;
    const from = this.nodes.get(n.parentId)!;
    const to = this.nodes.get(dest.parentId)!;
    const oldIdx = from.children!.indexOf(id);
    let idx = dest.index ?? to.children!.length;
    // Chrome quirk: the index is taken before the node is removed.
    if (this.flavor === 'chromium' && from === to && idx > oldIdx) idx--;
    from.children!.splice(oldIdx, 1);
    to.children!.splice(Math.min(idx, to.children!.length), 0, id);
    n.parentId = dest.parentId;
    return this.view(id);
  }

  async removeTree(id: string) {
    this.calls++;
    const n = this.nodes.get(id)!;
    const p = this.nodes.get(n.parentId)!;
    p.children = p.children!.filter((c) => c !== id);
    const drop = (x: string) => {
      const m = this.nodes.get(x)!;
      for (const c of m.children ?? []) drop(c);
      this.nodes.delete(x);
    };
    drop(id);
  }

  async remove(id: string) {
    return this.removeTree(id);
  }

  // ---- helpers for tests ----

  /** Creates nested content from a compact spec. */
  async seed(parentId: string, spec: Spec[]) {
    for (const s of spec) {
      if (typeof s === 'string') {
        await this.create({ parentId, title: s.replace(/^https?:\/\//, ''), url: s });
      } else if ('sep' in s) {
        await this.create({ parentId, type: 'separator' });
      } else {
        const f = await this.create({ parentId, title: s.folder });
        await this.seed(f.id, s.items);
      }
    }
  }

  find(pred: (n: Node) => boolean): string {
    for (const n of this.nodes.values()) if (pred(n)) return n.id;
    throw new Error('not found');
  }

  byUrl(url: string) {
    return this.find((n) => n.url === url);
  }
  byTitle(title: string) {
    return this.find((n) => n.title === title && n.url === undefined);
  }

  /** Comparable snapshot: root name → nested titles/urls. */
  async shape(): Promise<Record<string, unknown>> {
    const tree = await this.getTree();
    const out: Record<string, unknown> = {};
    const names: Record<string, string> = {
      '1': 'toolbar',
      '2': 'other',
      '3': 'mobile',
      toolbar_____: 'toolbar',
      unfiled_____: 'other',
      menu________: 'menu',
      mobile______: 'mobile',
    };
    const conv = (n: NativeNode): unknown =>
      kindOf(n) === 'folder' ? { [n.title]: (n.children ?? []).map(conv) } : kindOf(n) === 'separator' ? '---' : n.url;
    for (const r of tree[0].children ?? []) out[names[r.id]] = (r.children ?? []).map(conv);
    return out;
  }
}

export type Spec = string | { sep: true } | { folder: string; items: Spec[] };
