import MiniSearch from 'minisearch';
import { foldText, hostOf } from './normalize';
import { pathOf, type Tree } from './tree';

export interface SearchDoc {
  id: string;
  title: string;
  url: string;
  host: string;
  notes: string;
  tags: string;
  desc: string;
  path: string;
}

const TOKEN = /[\p{L}\p{N}]+/gu;

function tokenize(text: string): string[] {
  return foldText(text).match(TOKEN) ?? [];
}

export function createIndex(): MiniSearch<SearchDoc> {
  return new MiniSearch<SearchDoc>({
    fields: ['title', 'host', 'url', 'notes', 'tags', 'desc', 'path'],
    storeFields: [],
    tokenize,
    processTerm: (t) => t || null,
    searchOptions: {
      boost: { title: 4, tags: 3, host: 3, notes: 2, path: 1.5, desc: 1, url: 1 },
      prefix: true,
      fuzzy: (term) => (term.length > 3 ? 0.2 : false),
      combineWith: 'AND',
    },
  });
}

export function docsFromTree(tree: Tree): SearchDoc[] {
  const docs: SearchDoc[] = [];
  for (const n of tree.byId.values()) {
    if (n.kind !== 'bookmark') continue;
    const v = n.rec.v;
    docs.push({
      id: n.id,
      title: [v.label, n.title, v.siteTitle].filter(Boolean).join(' '),
      url: n.url.replace(/^https?:\/\/(www\.)?/, '').replace(/[/?#=&._-]+/g, ' '),
      host: hostOf(n.url).replace(/\./g, ' '),
      notes: v.notes ?? '',
      tags: (v.tags ?? []).join(' '),
      desc: v.desc ?? '',
      path: pathOf(tree, n.id).join(' '),
    });
  }
  return docs;
}

export function buildIndex(tree: Tree): MiniSearch<SearchDoc> {
  const index = createIndex();
  index.addAll(docsFromTree(tree));
  return index;
}

/** Searches; falls back to OR when AND finds nothing. */
export function searchIds(index: MiniSearch<SearchDoc>, query: string, limit = 500): string[] {
  const q = query.trim();
  if (!q) return [];
  let hits = index.search(q);
  if (!hits.length) hits = index.search(q, { combineWith: 'OR' });
  return hits.slice(0, limit).map((h) => h.id as string);
}
