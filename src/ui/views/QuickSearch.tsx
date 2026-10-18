import { ArrowUpRight, Folder, Pencil, Search, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { displayTitle, hostOf } from '../../core/normalize';
import { searchIds } from '../../core/search';
import type { TreeNode } from '../../core/tree';
import { Favicon, Preview, useFolderName } from '../components/bits';
import { Button, cx } from '../components/ui';
import type { Library } from '../hooks';
import { useI18n } from '../i18n';

const MAX = 9;

/**
 * Floating Spotlight-style search (Ctrl+K): live suggestions you can walk with
 * the arrow keys, and a preview of the highlighted bookmark.
 */
export function QuickSearch({
  lib,
  open,
  onClose,
  openDetails,
  showAll,
  remote,
}: {
  lib: Library;
  open: boolean;
  onClose: () => void;
  openDetails: (id: string) => void;
  /** Continue the search in the full library. */
  showAll: (query: string) => void;
  remote: boolean;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const hits = useMemo(() => {
    if (query.trim()) {
      return searchIds(lib.index, query, MAX)
        .map((id) => lib.tree.byId.get(id))
        .filter((n): n is TreeNode => !!n);
    }
    // Before typing: favorites, then the newest bookmarks.
    const fav = lib.bookmarks.filter((b) => b.rec.v.fav);
    const recent = [...lib.bookmarks].sort((a, b) => (b.rec.v.addedAt ?? 0) - (a.rec.v.addedAt ?? 0));
    return [...new Set([...fav, ...recent])].slice(0, MAX);
  }, [lib, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const go = (n: TreeNode) => {
    window.open(n.url, '_blank', 'noopener');
    onClose();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(hits.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault();
      if (e.shiftKey) {
        openDetails(hits[active].id);
        onClose();
      } else go(hits[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const current = hits[active];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-4 pt-[10vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="animate-in w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="relative border-b border-line">
          <Search className="pointer-events-none absolute start-5 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            autoFocus
            placeholder={t('homeSearch', { n: lib.bookmarks.length })}
            className="h-14 w-full bg-transparent pe-20 ps-14 text-lg outline-none placeholder:text-muted/70"
            aria-autocomplete="list"
          />
          <kbd className="absolute end-4 top-1/2 -translate-y-1/2 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted">Esc</kbd>
        </div>

        {hits.length ? (
          <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-1.5 md:border-e md:border-line">
              {hits.map((n, i) => (
                <button
                  key={n.id}
                  data-i={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(n)}
                  className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition', i === active ? 'bg-accent-soft' : 'hover:bg-hover')}
                >
                  <Favicon url={n.url} size={20} remote={remote} />
                  <span className="min-w-0 flex-1">
                    <span dir="auto" className={cx('block truncate text-sm font-medium', i === active && 'text-accent')}>
                      {displayTitle(n.title, n.url, n.rec.v)}
                    </span>
                    <span className="block truncate text-xs text-muted">{n.rec.v.notes || <span className="ltr">{hostOf(n.url)}</span>}</span>
                  </span>
                  {n.rec.v.fav && <Star className="size-3.5 shrink-0 fill-yellow-400 text-yellow-400" />}
                </button>
              ))}
              {query.trim() && (
                <button
                  onClick={() => {
                    showAll(query);
                    onClose();
                  }}
                  className="mt-1 w-full rounded-xl py-2 text-center text-xs text-accent hover:bg-hover"
                >
                  {t('homeAll')} →
                </button>
              )}
            </div>
            {current && (
              <PreviewPane
                lib={lib}
                node={current}
                remote={remote}
                onOpen={() => go(current)}
                onEdit={() => {
                  openDetails(current.id);
                  onClose();
                }}
              />
            )}
          </div>
        ) : (
          <p className="p-10 text-center text-sm text-muted">{t('noResults')}</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-[11px] text-muted">
          <span dir="ltr">{t('homeKeys')}</span>
          <span>{t('omniboxTip')}</span>
        </div>
      </div>
    </div>
  );
}

function PreviewPane({ lib, node, remote, onOpen, onEdit }: { lib: Library; node: TreeNode; remote: boolean; onOpen: () => void; onEdit: () => void }) {
  const { t } = useI18n();
  const name = useFolderName();
  const v = node.rec.v;
  const parent = lib.tree.byId.get(node.parent);
  const shown = displayTitle(node.title, node.url, v);
  return (
    <div className="hidden max-h-[60vh] flex-col overflow-y-auto md:flex">
      <div className="aspect-[16/9] shrink-0 overflow-hidden border-b border-line bg-hover">
        <Preview node={node} remote={remote} />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 dir="auto" className="text-base font-semibold leading-snug">
          {shown}
        </h3>
        <a href={node.url} target="_blank" rel="noreferrer" className="ltr truncate text-start text-xs text-accent">
          {node.url}
        </a>
        {v.siteTitle && v.siteTitle !== shown && (
          <p dir="auto" className="text-xs text-muted">
            {v.siteTitle}
          </p>
        )}
        {v.desc && (
          <p dir="auto" className="line-clamp-3 text-[13px] leading-relaxed text-fg/75">
            {v.desc}
          </p>
        )}
        {v.notes && (
          <p dir="auto" className="rounded-lg bg-accent-soft/60 px-3 py-2 text-[13px] leading-relaxed">
            {v.notes}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {parent && (
            <span className="inline-flex items-center gap-1 rounded-md bg-hover px-1.5 py-0.5 text-[11px] text-muted">
              <Folder className="size-3" />
              {name(parent)}
            </span>
          )}
          {(v.tags ?? []).map((tag) => (
            <span key={tag} dir="auto" className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">
              #{tag}
            </span>
          ))}
        </div>
        <div className="mt-auto flex gap-2 pt-2">
          <Button variant="primary" size="sm" icon={<ArrowUpRight className="size-4" />} onClick={onOpen}>
            {t('open')}
          </Button>
          <Button size="sm" icon={<Pencil className="size-4" />} onClick={onEdit}>
            {t('edit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
