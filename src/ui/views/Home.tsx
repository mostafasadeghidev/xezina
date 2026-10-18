import { ArrowUpRight, Clock, Folder, Pencil, Search, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { displayTitle, hostOf } from '../../core/normalize';
import { searchIds } from '../../core/search';
import type { TreeNode } from '../../core/tree';
import { Favicon, Preview, useFolderName } from '../components/bits';
import { Button, cx } from '../components/ui';
import type { Library } from '../hooks';
import { useI18n } from '../i18n';
import { Logo } from './Logo';

const MAX = 9;

/**
 * Spotlight-style start page: one big search box, live suggestions you can
 * walk with the arrow keys, and a preview of the highlighted bookmark.
 */
export function Home({
  lib,
  openDetails,
  showAll,
  remote,
  sameTab,
}: {
  lib: Library;
  openDetails: (id: string) => void;
  /** Continue the search in the full library. */
  showAll: (query: string) => void;
  remote: boolean;
  /** New-tab page: open sites in the same tab. */
  sameTab?: boolean;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const hits = useMemo(() => {
    if (!query.trim()) return [];
    return searchIds(lib.index, query, MAX)
      .map((id) => lib.tree.byId.get(id))
      .filter((n): n is TreeNode => !!n);
  }, [lib, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const open = (n: TreeNode) => {
    if (sameTab) location.href = n.url;
    else window.open(n.url, '_blank', 'noopener');
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
      if (e.shiftKey) openDetails(hits[active].id);
      else open(hits[active]);
    } else if (e.key === 'Escape') {
      setQuery('');
    }
  };

  const current = hits[active];
  const favorites = lib.bookmarks.filter((b) => b.rec.v.fav).slice(0, 12);
  const recent = [...lib.bookmarks].sort((a, b) => (b.rec.v.addedAt ?? 0) - (a.rec.v.addedAt ?? 0)).slice(0, 8);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col px-6 pb-16 pt-[9vh]">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo className="mb-4 size-12" />
          <h1 className="text-3xl font-bold tracking-tight">{t('homeTitle')}</h1>
        </div>

        <div className="relative mx-auto w-full max-w-3xl">
          <Search className="pointer-events-none absolute start-5 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder={t('homeSearch', { n: lib.bookmarks.length })}
            className="h-14 w-full rounded-2xl border border-line bg-panel pe-5 ps-14 text-lg shadow-lg shadow-black/5 outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15"
            aria-autocomplete="list"
          />
        </div>
        <p className="mt-2 text-center text-xs text-muted" dir="ltr">
          {query ? t('homeKeys') : ' '}
        </p>

        {query.trim() ? (
          hits.length ? (
            <div className="animate-in mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div ref={listRef} className="max-h-[60vh] self-start overflow-y-auto rounded-2xl border border-line bg-panel p-1.5">
                {hits.map((n, i) => (
                  <button
                    key={n.id}
                    data-i={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => open(n)}
                    className={cx(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition',
                      i === active ? 'bg-accent-soft' : 'hover:bg-hover',
                    )}
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
                <button onClick={() => showAll(query)} className="mt-1 w-full rounded-xl py-2 text-center text-xs text-accent hover:bg-hover">
                  {t('homeAll')} →
                </button>
              </div>
              {current && <PreviewPane lib={lib} node={current} remote={remote} onOpen={() => open(current)} onEdit={() => openDetails(current.id)} />}
            </div>
          ) : (
            <p className="mt-10 text-center text-sm text-muted">{t('noResults')}</p>
          )
        ) : (
          <div className="mt-8 space-y-8">
            {favorites.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted">
                  <Star className="size-4" />
                  {t('navFavorites')}
                </h2>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                  {favorites.map((n) => (
                    <a
                      key={n.id}
                      href={n.url}
                      target={sameTab ? undefined : '_blank'}
                      rel="noreferrer"
                      className="group flex flex-col items-center gap-2 rounded-2xl border border-line bg-panel p-4 text-center transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg"
                    >
                      <span className="flex size-11 items-center justify-center rounded-xl bg-hover">
                        <Favicon url={n.url} size={24} remote={remote} />
                      </span>
                      <span dir="auto" className="line-clamp-2 text-xs font-medium">
                        {displayTitle(n.title, n.url, n.rec.v)}
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            )}
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted">
                <Clock className="size-4" />
                {t('navRecent')}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {recent.map((n) => (
                  <div key={n.id} className="group flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5 transition hover:border-accent/40">
                    <Favicon url={n.url} size={18} remote={remote} />
                    <a href={n.url} target={sameTab ? undefined : '_blank'} rel="noreferrer" className="min-w-0 flex-1 hover:no-underline">
                      <span dir="auto" className="block truncate text-sm font-medium text-fg">
                        {displayTitle(n.title, n.url, n.rec.v)}
                      </span>
                      <span className="ltr block truncate text-start text-xs text-muted">{hostOf(n.url)}</span>
                    </a>
                    <button onClick={() => openDetails(n.id)} className="text-muted opacity-0 transition hover:text-fg group-hover:opacity-100" title={t('edit')}>
                      <Pencil className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewPane({ lib, node, remote, onOpen, onEdit }: { lib: Library; node: TreeNode; remote: boolean; onOpen: () => void; onEdit: () => void }) {
  const { t } = useI18n();
  const name = useFolderName();
  const v = node.rec.v;
  const parent = lib.tree.byId.get(node.parent);
  return (
    <div className="animate-in flex flex-col overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="aspect-[16/9] overflow-hidden border-b border-line bg-hover">
        <Preview node={node} remote={remote} />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 dir="auto" className="text-base font-semibold leading-snug">
          {displayTitle(node.title, node.url, v)}
        </h3>
        <a href={node.url} target="_blank" rel="noreferrer" className="ltr truncate text-start text-xs text-accent">
          {node.url}
        </a>
        {v.siteTitle && v.siteTitle !== displayTitle(node.title, node.url, v) && (
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
