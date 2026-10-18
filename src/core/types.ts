/**
 * Data model shared by every part of Xezina.
 *
 * Each bookmark/folder is a record whose fields are independent
 * last-writer-wins registers. Every field carries the stamp of the write that
 * produced it, so two devices can merge their copies field by field without a
 * central server (a state-based CRDT).
 */

/** Hybrid-logical-clock stamp. Lexicographic order == causal/time order. */
export type Stamp = string;

export type Kind = 'folder' | 'bookmark' | 'separator';

export interface FieldValues {
  kind: Kind;
  /** Parent record id (a folder or one of the ROOT ids). */
  parent: string;
  /** Fractional order key among siblings. */
  pos: string;
  title: string;
  url: string;
  /** User notes. */
  notes: string;
  tags: string[];
  fav: boolean;
  /** Tombstone. */
  del: boolean;
  /** When the bookmark was first created (ms). */
  addedAt: number;
  /** Description extracted from the page. */
  desc: string;
  /** Preview image: sha-256 hash of a blob, or '' for none. */
  img: string;
  /** Where the preview came from. */
  imgSrc: 'og' | 'shot' | 'user' | '';
  /** Last HTTP status from the link checker (0 = network error). */
  status: number;
  /** When the page was last fetched for metadata / link check (ms). */
  checkedAt: number;
}

export type FieldName = keyof FieldValues;

export interface Rec {
  id: string;
  v: Partial<FieldValues>;
  s: Partial<Record<FieldName, Stamp>>;
}

/** All records keyed by id. Tombstones are kept so deletions propagate. */
export type State = Record<string, Rec>;

export const ROOT = {
  toolbar: 'root_toolbar',
  other: 'root_other',
  menu: 'root_menu',
  mobile: 'root_mobile',
} as const;

export type RootId = (typeof ROOT)[keyof typeof ROOT];

export const ROOT_IDS: RootId[] = [ROOT.toolbar, ROOT.other, ROOT.menu, ROOT.mobile];

export function isRoot(id: string): id is RootId {
  return (ROOT_IDS as string[]).includes(id);
}

/** Fields that describe the bookmark tree (mirrored into the browser). */
export const TREE_FIELDS: FieldName[] = ['kind', 'parent', 'pos', 'title', 'url'];
