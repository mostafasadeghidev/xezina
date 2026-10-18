import MiniSearch from 'minisearch';
import { fuzzyMatch, prepare, queryWords, type Prepared } from './fuzzy';
import { displayTitle, foldText, hostOf } from './normalize';
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

interface Entry {
  id: string;
  name: Prepared;
  host: Prepared;
  url: Prepared;
  /** Notes, tags, description and folder names, letters only (substring search). */
  extra: string;
}

/**
 * Two searches combined: word search (MiniSearch: whole words, prefixes,
 * small typos, relevance across fields) and fuzzy letter matching on the
 * name and address ("checkhost" → "check-host.net").
 */
export class Searcher {
  private mini = createIndex();
  private entries: Entry[] = [];

  constructor(tree: Tree) {
    const docs = docsFromTree(tree);
    this.mini.addAll(docs);
    for (const d of docs) {
      const n = tree.byId.get(d.id)!;
      this.entries.push({
        id: d.id,
        name: prepare(displayTitle(n.title, n.url, n.rec.v) + ' ' + [n.title, n.rec.v.siteTitle].filter(Boolean).join(' ')),
        host: prepare(hostOf(n.url)),
        url: prepare(n.url.replace(/^https?:\/\/(www\.)?[^/]+/, '')),
        extra: prepare([d.notes, d.tags, d.desc, d.path].join(' ')).text,
      });
    }
  }

  search(query: string, limit = 500): { id: string; score: number }[] {
    const words = queryWords(query);
    if (!words.length) return [];
    const scores = new Map<string, number>();

    // Word search: strong when whole words match; normalised to 0..240.
    let hits = this.mini.search(query);
    if (!hits.length) hits = this.mini.search(query, { combineWith: 'OR' });
    const top = hits[0]?.score ?? 1;
    for (const h of hits) scores.set(h.id as string, (240 * h.score) / top);

    // Letter matching on name / site / address.
    const all = words.join('');
    for (const e of this.entries) {
      const field = (w: string) =>
        Math.max(
          fuzzyMatch(w, e.name)?.score ?? 0,
          (fuzzyMatch(w, e.host)?.score ?? 0) * 0.9,
          (fuzzyMatch(w, e.url)?.score ?? 0) * 0.5,
          w.length > 1 && e.extra.includes(w) ? 60 + w.length * 6 : 0,
        );
      let fuzzy = words.length > 1 ? field(all) : 0;
      let each = 0;
      for (const w of words) {
        const s = field(w);
        if (!s) {
          each = 0;
          break;
        }
        each += s;
      }
      fuzzy = Math.max(fuzzy, each / words.length);
      if (fuzzy > 0) scores.set(e.id, (scores.get(e.id) ?? 0) + fuzzy);
    }

    return [...scores]
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export function buildIndex(tree: Tree): Searcher {
  return new Searcher(tree);
}

/** Best-first ids for a query. */
export function searchIds(index: Searcher, query: string, limit = 500): string[] {
  return index.search(query, limit).map((h) => h.id);
}
