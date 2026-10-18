import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import { normalizeUrl } from '../core/normalize';
import { buildIndex } from '../core/search';
import { buildTree, type Tree } from '../core/tree';
import type { Rec, State } from '../core/types';
import { db, DEFAULT_STATUS, type EnrichStatus, type SyncStatus } from '../db/db';
import { send } from '../lib/messages';
import { DEFAULT_SETTINGS, getSettings, onSettingsChanged, saveSettings, type Settings } from '../lib/settings';

export function useSettings(): [Settings, (patch: Partial<Settings>) => Promise<void>, boolean] {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void getSettings().then((x) => {
      setS(x);
      setReady(true);
    });
    return onSettingsChanged(setS);
  }, []);
  const update = async (patch: Partial<Settings>) => {
    setS(await saveSettings(patch));
  };
  return [s, update, ready];
}

/** Applies the theme class to <html>. */
export function useTheme(theme: Settings['theme']) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export function useRecords(): Rec[] | undefined {
  return useLiveQuery(() => db.records.toArray(), []);
}

export function useStatus(): SyncStatus {
  return useLiveQuery(async () => ((await db.kv.get('status'))?.value as SyncStatus) ?? DEFAULT_STATUS, []) ?? DEFAULT_STATUS;
}

export function useEnrichStatus(): EnrichStatus {
  return (
    useLiveQuery(async () => ((await db.kv.get('enrich'))?.value as EnrichStatus) ?? { running: false, done: 0, total: 0 }, []) ?? {
      running: false,
      done: 0,
      total: 0,
    }
  );
}

export interface Library {
  tree: Tree;
  index: ReturnType<typeof buildIndex>;
  /** Bookmarks only. */
  bookmarks: Tree['byId'] extends Map<string, infer N> ? N[] : never;
  /** Recursive bookmark count per folder id. */
  counts: Map<string, number>;
  tags: [string, number][];
  dupGroups: Map<string, string[]>;
}

export function useLibrary(records: Rec[] | undefined): Library | null {
  return useMemo(() => {
    if (!records) return null;
    const state: State = {};
    for (const r of records) state[r.id] = r;
    const tree = buildTree(state);
    const bookmarks = [...tree.byId.values()].filter((n) => n.kind === 'bookmark');
    const counts = new Map<string, number>();
    const tagCount = new Map<string, number>();
    const byUrl = new Map<string, string[]>();
    for (const b of bookmarks) {
      let p = b.parent;
      const guard = new Set<string>();
      while (p && !guard.has(p)) {
        guard.add(p);
        counts.set(p, (counts.get(p) ?? 0) + 1);
        p = tree.byId.get(p)?.parent ?? '';
      }
      for (const t of b.rec.v.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
      const key = normalizeUrl(b.url);
      const list = byUrl.get(key);
      if (list) list.push(b.id);
      else byUrl.set(key, [b.id]);
    }
    const dupGroups = new Map([...byUrl].filter(([, ids]) => ids.length > 1));
    const tags = [...tagCount].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return { tree, index: buildIndex(tree), bookmarks, counts, tags, dupGroups };
  }, [records]);
}

const blobUrls = new Map<string, string>();
const requested = new Set<string>();

/** Object URL for a preview image; asks the background to download it when missing. */
export function useBlobUrl(hash: string | undefined): string | undefined {
  const row = useLiveQuery(async () => (hash ? ((await db.blobs.get(hash)) ?? null) : null), [hash]);
  useEffect(() => {
    if (hash && row === null && !requested.has(hash)) {
      requested.add(hash);
      void send({ type: 'blob:fetch', hash }).catch(() => undefined);
    }
  }, [hash, row]);
  if (!hash || !row) return undefined;
  let url = blobUrls.get(hash);
  if (!url) {
    url = URL.createObjectURL(row.blob);
    blobUrls.set(hash, url);
  }
  return url;
}

const isFirefox = import.meta.env.FIREFOX;

export function faviconUrl(pageUrl: string, allowRemote: boolean): string | undefined {
  if (!/^https?:/i.test(pageUrl)) return undefined;
  if (!isFirefox) {
    const u = new URL(browser.runtime.getURL('/_favicon/' as '/manager.html'));
    u.searchParams.set('pageUrl', pageUrl);
    u.searchParams.set('size', '32');
    return u.toString();
  }
  if (!allowRemote) return undefined;
  try {
    return `https://icons.duckduckgo.com/ip3/${new URL(pageUrl).hostname}.ico`;
  } catch {
    return undefined;
  }
}

export function useHashRoute(): [string, (r: string) => void] {
  const [route, setRoute] = useState(() => location.hash.slice(1) || '/home');
  useEffect(() => {
    const on = () => setRoute(location.hash.slice(1) || '/home');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [
    route,
    (r: string) => {
      location.hash = r;
    },
  ];
}
