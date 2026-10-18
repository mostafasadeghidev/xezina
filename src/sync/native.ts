import { ROOT, type RootId } from '../core/types';

/** The subset of the browser bookmarks API that Xezina uses. */
export interface NativeNode {
  id: string;
  parentId?: string;
  index?: number;
  title: string;
  url?: string;
  type?: 'bookmark' | 'folder' | 'separator';
  dateAdded?: number;
  unmodifiable?: string;
  /** Chrome 134+: 'bookmarks-bar' | 'other' | 'mobile' | 'managed'. */
  folderType?: string;
  /** Chrome 134+: true for account (synced) storage. */
  syncing?: boolean;
  children?: NativeNode[];
}

export interface CreateDetails {
  parentId: string;
  index?: number;
  title?: string;
  url?: string;
  type?: 'bookmark' | 'folder' | 'separator';
}

export interface NativeApi {
  getTree(): Promise<NativeNode[]>;
  create(details: CreateDetails): Promise<NativeNode>;
  update(id: string, changes: { title?: string; url?: string }): Promise<NativeNode>;
  move(id: string, dest: { parentId: string; index?: number }): Promise<NativeNode>;
  removeTree(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export type Flavor = 'firefox' | 'chromium';

export function flavorOf(tree: NativeNode[]): Flavor {
  return tree[0]?.id === 'root________' ? 'firefox' : 'chromium';
}

const FIREFOX_ROOTS: Record<string, RootId> = {
  toolbar_____: ROOT.toolbar,
  unfiled_____: ROOT.other,
  menu________: ROOT.menu,
  mobile______: ROOT.mobile,
};

const FOLDER_TYPES: Record<string, RootId> = {
  'bookmarks-bar': ROOT.toolbar,
  other: ROOT.other,
  mobile: ROOT.mobile,
};

const CHROMIUM_IDS: Record<string, RootId> = { '1': ROOT.toolbar, '2': ROOT.other, '3': ROOT.mobile };

/**
 * Finds the browser's built-in top-level folders.
 * Roots the browser does not have (e.g. "Bookmarks menu" in Chrome) are absent.
 */
export function detectRoots(tree: NativeNode[]): Partial<Record<RootId, NativeNode>> {
  const top = tree[0]?.children ?? [];
  const out: Partial<Record<RootId, NativeNode>> = {};
  if (flavorOf(tree) === 'firefox') {
    for (const n of top) {
      const r = FIREFOX_ROOTS[n.id];
      if (r) out[r] = n;
    }
    return out;
  }
  // Chrome 134+ may list both local and account folders; prefer the synced copy.
  const typed = top.filter((n) => n.folderType && FOLDER_TYPES[n.folderType]);
  if (typed.length) {
    for (const n of typed) {
      const r = FOLDER_TYPES[n.folderType as string];
      const cur = out[r];
      if (!cur || (n.syncing && !cur.syncing)) out[r] = n;
    }
    return out;
  }
  for (const n of top) {
    const r = CHROMIUM_IDS[n.id];
    if (r) out[r] = n;
  }
  if (!out[ROOT.toolbar] && top[0]) out[ROOT.toolbar] = top[0];
  if (!out[ROOT.other] && top[1]) out[ROOT.other] = top[1];
  return out;
}

/** Title for a stand-in folder when the browser lacks a root. */
export const PROXY_TITLES: Partial<Record<RootId, string>> = {
  [ROOT.menu]: 'Bookmarks Menu',
  [ROOT.mobile]: 'Mobile Bookmarks',
};

export function kindOf(n: NativeNode): 'bookmark' | 'folder' | 'separator' {
  if (n.type === 'separator') return 'separator';
  if (n.url !== undefined && n.url !== null) return 'bookmark';
  return n.type === 'bookmark' ? 'bookmark' : 'folder';
}
