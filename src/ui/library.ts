import { displayTitle, hostOf, normalizeUrl } from '../core/normalize';
import { searchIds } from '../core/search';
import type { TreeNode } from '../core/tree';
import { linkHealth } from '../enrich/metadata';
import type { Library } from './hooks';

export type Filter =
  | { kind: 'all' }
  | { kind: 'fav' }
  | { kind: 'recent' }
  | { kind: 'dups' }
  | { kind: 'broken' }
  | { kind: 'untagged' }
  | { kind: 'folder'; id: string }
  | { kind: 'tag'; tag: string };

export type Sort = 'manual' | 'newest' | 'oldest' | 'title' | 'site';

export function parseRoute(route: string): { page: 'library' | 'dashboard' | 'settings'; filter: Filter; tab?: string } {
  const [, page, a, b] = route.split('/');
  if (page === 'dashboard') return { page: 'dashboard', filter: { kind: 'all' } };
  if (page === 'settings') return { page: 'settings', filter: { kind: 'all' }, tab: a || 'general' };
  if (page === 'folder' && a) return { page: 'library', filter: { kind: 'folder', id: decodeURIComponent(a) } };
  if (page === 'tag' && a) return { page: 'library', filter: { kind: 'tag', tag: decodeURIComponent(a) } };
  const kinds = ['all', 'fav', 'recent', 'dups', 'broken', 'untagged'] as const;
  const k = kinds.find((x) => x === a) ?? 'all';
  void b;
  return { page: 'library', filter: { kind: k } as Filter };
}

export function routeOf(f: Filter): string {
  if (f.kind === 'folder') return `/folder/${encodeURIComponent(f.id)}`;
  if (f.kind === 'tag') return `/tag/${encodeURIComponent(f.tag)}`;
  return `/library/${f.kind}`;
}

const added = (n: TreeNode) => n.rec.v.addedAt ?? 0;

/** Bookmarks shown for a filter + search + sort. */
export function select(lib: Library, filter: Filter, query: string, sort: Sort): TreeNode[] {
  let items: TreeNode[];
  switch (filter.kind) {
    case 'folder': {
      const f = lib.tree.byId.get(filter.id);
      items = query ? descendants(f) : (f?.children.filter((c) => c.kind === 'bookmark') ?? []);
      break;
    }
    case 'fav':
      items = lib.bookmarks.filter((b) => b.rec.v.fav);
      break;
    case 'recent': {
      const cutoff = Date.now() - 30 * 86400_000;
      items = lib.bookmarks.filter((b) => added(b) >= cutoff);
      if (items.length < 30) items = [...lib.bookmarks].sort((a, b) => added(b) - added(a)).slice(0, 60);
      break;
    }
    case 'dups': {
      const ids = new Set([...lib.dupGroups.values()].flat());
      items = lib.bookmarks.filter((b) => ids.has(b.id));
      break;
    }
    case 'broken':
      items = lib.bookmarks.filter((b) => linkHealth(b.rec.v.status, b.rec.v.checkedAt) === 'broken');
      break;
    case 'untagged':
      items = lib.bookmarks.filter((b) => !(b.rec.v.tags ?? []).length);
      break;
    case 'tag':
      items = lib.bookmarks.filter((b) => (b.rec.v.tags ?? []).includes(filter.tag));
      break;
    default:
      items = lib.bookmarks;
  }

  if (query.trim()) {
    // `#tag` narrows to a tag, `site:host` to a site, the rest is full-text.
    let q = query;
    for (const m of query.matchAll(/(?:^|\s)#([^\s#]+)/g)) {
      const tag = m[1].toLowerCase();
      items = items.filter((b) => (b.rec.v.tags ?? []).some((t) => t.startsWith(tag)));
      q = q.replace(m[0], ' ');
    }
    for (const m of query.matchAll(/(?:^|\s)site:(\S+)/gi)) {
      const host = m[1].toLowerCase();
      items = items.filter((b) => hostOf(b.url).includes(host));
      q = q.replace(m[0], ' ');
    }
    if (q.trim()) {
      const allowed = new Set(items.map((b) => b.id));
      const ranked = searchIds(lib.index, q, 2000).filter((id) => allowed.has(id));
      items = ranked.map((id) => lib.tree.byId.get(id)!).filter(Boolean);
      if (sort === 'manual') return items; // keep relevance order
    }
  }

  const sorted = [...items];
  switch (sort) {
    case 'newest':
      sorted.sort((a, b) => added(b) - added(a));
      break;
    case 'oldest':
      sorted.sort((a, b) => added(a) - added(b));
      break;
    case 'title':
      sorted.sort((a, b) => displayTitle(a.title, a.url, a.rec.v).localeCompare(displayTitle(b.title, b.url, b.rec.v)));
      break;
    case 'site':
      sorted.sort((a, b) => hostOf(a.url).localeCompare(hostOf(b.url)) || a.title.localeCompare(b.title));
      break;
    default:
      if (filter.kind === 'dups') sorted.sort((a, b) => normalizeUrl(a.url).localeCompare(normalizeUrl(b.url)));
      else if (filter.kind !== 'folder') sorted.sort((a, b) => added(b) - added(a));
  }
  return sorted;
}

function descendants(n: TreeNode | undefined): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (x: TreeNode) => {
    for (const c of x.children) {
      if (c.kind === 'bookmark') out.push(c);
      else if (c.kind === 'folder') walk(c);
    }
  };
  if (n) walk(n);
  return out;
}

/**
 * Which copy of a duplicated bookmark to keep: the one with notes/tags/favorite,
 * then the one in the bookmarks bar, then the oldest.
 */
export function pickKeeper(lib: Library, ids: string[]): string {
  const inToolbar = (id: string) => {
    let p = lib.tree.byId.get(id)?.parent;
    const seen = new Set<string>();
    while (p && !seen.has(p)) {
      if (p === 'root_toolbar') return true;
      seen.add(p);
      p = lib.tree.byId.get(p)?.parent;
    }
    return false;
  };
  const score = (id: string) => {
    const v = lib.tree.byId.get(id)?.rec.v ?? {};
    return (v.notes ? 4 : 0) + ((v.tags ?? []).length ? 4 : 0) + (v.label ? 2 : 0) + (v.fav ? 2 : 0) + (inToolbar(id) ? 1 : 0);
  };
  return [...ids].sort((a, b) => {
    const d = score(b) - score(a);
    if (d) return d;
    const ta = lib.tree.byId.get(a)?.rec.v.addedAt ?? Infinity;
    const tb = lib.tree.byId.get(b)?.rec.v.addedAt ?? Infinity;
    return ta - tb || (a < b ? -1 : 1);
  })[0];
}
