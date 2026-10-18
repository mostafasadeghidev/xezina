import { Check, ChevronDown, Folder, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { foldText, hostOf, uniqueTags } from '../../core/normalize';
import type { Tree, TreeNode } from '../../core/tree';
import { isRoot, ROOT } from '../../core/types';
import { faviconUrl, useBlobUrl } from '../hooks';
import { useI18n, type StringKey } from '../i18n';
import { cx, inputClass } from './ui';

const ROOT_KEYS: Record<string, StringKey> = {
  [ROOT.toolbar]: 'rootToolbar',
  [ROOT.other]: 'rootOther',
  [ROOT.menu]: 'rootMenu',
  [ROOT.mobile]: 'rootMobile',
};

/** Localized name of a folder (built-in folders get translated names). */
export function useFolderName() {
  const { t } = useI18n();
  return (node: TreeNode | undefined) => (node ? (isRoot(node.id) ? t(ROOT_KEYS[node.id]) : node.title || '—') : '');
}

function hue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function Favicon({ url, size = 16, remote = true }: { url: string; size?: number; remote?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = faviconUrl(url, remote);
  const host = hostOf(url);
  if (!src || failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded font-semibold text-white"
        style={{ width: size, height: size, fontSize: size * 0.6, background: `hsl(${hue(host)} 55% 50%)` }}
      >
        {(host[0] ?? '•').toUpperCase()}
      </span>
    );
  }
  return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-sm" onError={() => setFailed(true)} loading="lazy" />;
}

/** Preview image, or a colored placeholder with the site's initial. */
export function Preview({ node, className, remote }: { node: TreeNode; className?: string; remote: boolean }) {
  const src = useBlobUrl(node.rec.v.img || undefined);
  const host = hostOf(node.url);
  if (src) return <img src={src} alt="" loading="lazy" className={cx('h-full w-full object-cover', className)} />;
  const h = hue(host);
  return (
    <div
      className={cx('flex h-full w-full items-center justify-center', className)}
      style={{ background: `linear-gradient(135deg, hsl(${h} 60% 55% / .22), hsl(${(h + 40) % 360} 60% 50% / .10))` }}
    >
      <div className="flex w-full flex-col items-center gap-2 px-4 opacity-80">
        <Favicon url={node.url} size={28} remote={remote} />
        <span className="ltr max-w-full truncate text-xs text-muted">{host}</span>
      </div>
    </div>
  );
}

export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return suggestions.filter((s) => s.includes(q) && !value.includes(s)).slice(0, 6);
  }, [text, suggestions, value]);
  const add = (t: string) => {
    const next = uniqueTags([...value, ...t.split(/[,،]/)]);
    onChange(next);
    setText('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',' || e.key === '،') && text.trim()) {
      e.preventDefault();
      add(text);
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  return (
    <div className="relative">
      <div className={cx(inputClass, 'flex min-h-10 flex-wrap items-center gap-1.5 py-1.5')}>
        {value.map((t) => (
          <span key={t} dir="auto" className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs text-accent">
            #{t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="opacity-60 hover:opacity-100">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => text.trim() && add(text)}
          placeholder={value.length ? '' : placeholder}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
        />
      </div>
      {matches.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-line bg-panel shadow-lg">
          {matches.map((m) => (
            <button
              key={m}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                add(m);
              }}
              className="block w-full px-3 py-1.5 text-start text-sm hover:bg-hover"
            >
              #{m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Flat, indented list of folders for <select>. */
export function folderOptions(tree: Tree, name: (n: TreeNode) => string): { id: string; label: string; depth: number }[] {
  const out: { id: string; label: string; depth: number }[] = [];
  const walk = (n: TreeNode, depth: number) => {
    out.push({ id: n.id, label: name(n), depth });
    for (const c of n.children) if (c.kind === 'folder') walk(c, depth + 1);
  };
  for (const rid of [ROOT.toolbar, ROOT.other, ROOT.menu, ROOT.mobile]) {
    const r = tree.roots[rid];
    if (rid === ROOT.menu || rid === ROOT.mobile) {
      if (!r.children.length) continue;
    }
    walk(r, 0);
  }
  return out;
}

const RECENT_KEY = 'xz.recentFolders';

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function rememberFolder(id: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...loadRecent().filter((x) => x !== id)].slice(0, 5)));
  } catch {
    // ignore
  }
}

/**
 * Folder picker with live search: type part of a folder's name (or its
 * parents') and pick from the matches with the mouse or ↑ ↓ Enter.
 * Opens inline (not as a floating menu) so it also fits the small popup.
 */
export function FolderSelect({
  tree,
  value,
  onChange,
  exclude,
}: {
  tree: Tree;
  value: string;
  onChange: (id: string) => void;
  exclude?: string;
}) {
  const { t } = useI18n();
  const name = useFolderName();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const all = useMemo(() => {
    const out: { id: string; label: string; path: string; depth: number; key: string }[] = [];
    const walk = (n: TreeNode, depth: number, trail: string[]) => {
      const label = name(n);
      const path = [...trail, label];
      if (n.id !== exclude) out.push({ id: n.id, label, path: path.join(' › '), depth, key: foldText(path.join(' ')) });
      for (const c of n.children) if (c.kind === 'folder') walk(c, depth + 1, path);
    };
    for (const rid of [ROOT.toolbar, ROOT.other, ROOT.menu, ROOT.mobile]) {
      const r = tree.roots[rid];
      if ((rid === ROOT.menu || rid === ROOT.mobile) && !r.children.length) continue;
      walk(r, 0, []);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, exclude, t]);

  const shown = useMemo(() => {
    const words = foldText(query).split(/\s+/).filter(Boolean);
    if (!words.length) {
      const byId = new Map(all.map((o) => [o.id, o]));
      const recent = loadRecent()
        .map((id) => byId.get(id))
        .filter((o): o is (typeof all)[number] => !!o)
        .slice(0, 3);
      return { recent, list: all };
    }
    // Every word must appear somewhere in the folder's path; the folder's own name ranks first.
    const hits = all.filter((o) => words.every((w) => o.key.includes(w)));
    hits.sort((a, b) => {
      const an = words.every((w) => foldText(a.label).includes(w)) ? 0 : 1;
      const bn = words.every((w) => foldText(b.label).includes(w)) ? 0 : 1;
      return an - bn || a.depth - b.depth;
    });
    return { recent: [], list: hits };
  }, [all, query]);

  const items = [...shown.recent, ...shown.list];
  const current = all.find((o) => o.id === value);

  useEffect(() => setActive(0), [query, open]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (id: string) => {
    onChange(id);
    rememberFolder(id);
    setOpen(false);
    setQuery('');
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx(inputClass, 'flex h-10 cursor-pointer items-center gap-2 text-start')}
        title={current?.path}
      >
        <Folder className="size-4 shrink-0 text-muted" />
        <span dir="auto" className="min-w-0 flex-1 truncate">
          {current?.label ?? '—'}
        </span>
        {current && current.depth > 0 && (
          <span dir="auto" className="max-w-[40%] truncate text-xs text-muted">
            {current.path.split(' › ').slice(0, -1).join(' › ')}
          </span>
        )}
        <ChevronDown className="size-4 shrink-0 text-muted" />
      </button>
    );
  }

  const row = (o: (typeof all)[number], i: number, flat: boolean) => (
    <button
      key={`${flat ? 'r' : 'a'}-${o.id}`}
      type="button"
      data-i={i}
      onMouseEnter={() => setActive(i)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => choose(o.id)}
      className={cx(
        'flex w-full items-center gap-2 rounded-md py-1.5 pe-2 text-start text-[13px]',
        i === active ? 'bg-accent-soft text-accent' : 'hover:bg-hover',
        o.id === value && 'font-semibold',
      )}
      style={{ paddingInlineStart: flat || query ? 8 : 8 + o.depth * 14 }}
    >
      <Folder className="size-3.5 shrink-0 opacity-70" />
      <span dir="auto" className="min-w-0 flex-1 truncate">
        {o.label}
      </span>
      {(flat || query) && o.depth > 0 && (
        <span dir="auto" className="max-w-[50%] truncate text-[11px] text-muted">
          {o.path.split(' › ').slice(0, -1).join(' › ')}
        </span>
      )}
      {o.id === value && <Check className="size-3.5 shrink-0" />}
    </button>
  );

  return (
    <div
      ref={boxRef}
      className="rounded-lg border border-accent bg-card ring-2 ring-accent/20"
      onBlur={(e) => {
        if (!boxRef.current?.contains(e.relatedTarget as Node)) {
          setOpen(false);
          setQuery('');
        }
      }}
    >
      <div className="relative border-b border-line">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('folderSearch')}
          className="h-9 w-full bg-transparent pe-3 ps-9 text-sm outline-none placeholder:text-muted/70"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (items[active]) choose(items[active].id);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              setQuery('');
            }
          }}
        />
      </div>
      <div ref={listRef} className="max-h-56 overflow-y-auto p-1">
        {shown.recent.length > 0 && (
          <>
            <div className="px-2 pb-0.5 pt-1 text-[11px] font-medium text-muted">{t('recentFolders')}</div>
            {shown.recent.map((o, i) => row(o, i, true))}
            <div className="px-2 pb-0.5 pt-2 text-[11px] font-medium text-muted">{t('allFolders')}</div>
          </>
        )}
        {shown.list.map((o, i) => row(o, i + shown.recent.length, false))}
        {!items.length && <p className="p-3 text-center text-xs text-muted">{t('noResults')}</p>}
      </div>
    </div>
  );
}
