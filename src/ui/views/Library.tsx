import {
  ArrowUpRight,
  Bookmark,
  Check,
  Folder,
  FolderInput,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  Star,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { hostOf } from '../../core/normalize';
import { pathOf, type TreeNode } from '../../core/tree';
import { isRoot, ROOT } from '../../core/types';
import { linkHealth } from '../../enrich/metadata';
import { send } from '../../lib/messages';
import { Favicon, FolderSelect, Preview, TagInput, useFolderName } from '../components/bits';
import { Button, cx, Empty, IconButton, Input, Modal, Select, useConfirm, useToast } from '../components/ui';
import { useStatus, type Library as Lib } from '../hooks';
import { useI18n } from '../i18n';
import { routeOf, select, type Filter, type Sort } from '../library';
import { DRAG_TYPE } from './Sidebar';

function loadPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem('xz.' + key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function savePref(key: string, v: unknown) {
  try {
    localStorage.setItem('xz.' + key, JSON.stringify(v));
  } catch {
    // ignore
  }
}

export function LibraryView({
  lib,
  filter,
  query,
  setQuery,
  go,
  openDetails,
  onAdd,
  remote,
}: {
  lib: Lib;
  filter: Filter;
  query: string;
  setQuery: (q: string) => void;
  go: (r: string) => void;
  openDetails: (id: string) => void;
  onAdd: () => void;
  remote: boolean;
}) {
  const { t, num } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const name = useFolderName();
  const status = useStatus();
  const [mode, setMode] = useState<'grid' | 'list'>(() => loadPref('mode', 'grid'));
  const [sort, setSort] = useState<Sort>(() => loadPref('sort', 'manual'));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => savePref('mode', mode), [mode]);
  useEffect(() => savePref('sort', sort), [sort]);
  useEffect(() => setSelected(new Set()), [filter]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = /INPUT|TEXTAREA|SELECT/.test(target.tagName);
      if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === 'Escape' && target === searchRef.current) {
        setQuery('');
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [setQuery]);

  const items = useMemo(() => select(lib, filter, query, sort), [lib, filter, query, sort]);
  const folderNode = filter.kind === 'folder' ? lib.tree.byId.get(filter.id) : undefined;
  const subfolders = !query && folderNode ? folderNode.children.filter((c) => c.kind === 'folder') : [];

  const heading = (() => {
    switch (filter.kind) {
      case 'folder':
        return name(folderNode);
      case 'tag':
        return '#' + filter.tag;
      case 'fav':
        return t('navFavorites');
      case 'recent':
        return t('navRecent');
      case 'dups':
        return t('navDuplicates');
      case 'broken':
        return t('navBroken');
      case 'untagged':
        return t('navUntagged');
      default:
        return t('navAll');
    }
  })();
  const crumbs = folderNode && !isRoot(folderNode.id) ? pathOf(lib.tree, folderNode.id) : [];

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const run = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const removeSelected = async () => {
    const ids = [...selected];
    if (!(await confirm({ message: t('confirmDelete', { n: ids.length }), ok: t('delete'), cancel: t('cancel'), danger: true }))) return;
    await run(send({ type: 'remove', ids }));
    setSelected(new Set());
  };

  const onDragStart = (e: DragEvent, id: string) => {
    const ids = selected.has(id) ? [...selected] : [id];
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* toolbar */}
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-panel/60 px-6 py-3 backdrop-blur">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-10 w-full rounded-xl border border-line bg-card pe-16 ps-9 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          {query ? (
            <button onClick={() => setQuery('')} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg">
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 rounded border border-line px-1.5 text-[11px] text-muted">/</kbd>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-line bg-card p-0.5">
          <IconButton label={t('viewGrid')} active={mode === 'grid'} onClick={() => setMode('grid')} className="size-8">
            <LayoutGrid className="size-4" />
          </IconButton>
          <IconButton label={t('viewList')} active={mode === 'list'} onClick={() => setMode('list')} className="size-8">
            <List className="size-4" />
          </IconButton>
        </div>
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="!w-auto">
          <option value="manual">{t('sortManual')}</option>
          <option value="newest">{t('sortNewest')}</option>
          <option value="oldest">{t('sortOldest')}</option>
          <option value="title">{t('sortTitle')}</option>
          <option value="site">{t('sortSite')}</option>
        </Select>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={onAdd}>
          {t('addBookmark')}
        </Button>
        <IconButton
          label={t('syncNow')}
          onClick={() => void run(send({ type: 'sync' }))}
          className="border border-line bg-card size-10"
        >
          <RefreshCw className={cx('size-4', status.state === 'running' && 'animate-spin')} />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] px-6 pb-24 pt-5">
          {/* heading */}
          <div className="mb-4 flex items-end justify-between gap-4">
            <div className="min-w-0">
              {crumbs.length > 0 && <div className="mb-0.5 truncate text-xs text-muted">{crumbs.join(' / ')}</div>}
              <div className="flex items-center gap-1">
                <h1 dir="auto" className="truncate text-2xl font-bold tracking-tight">
                  {heading}
                </h1>
                {folderNode && !isRoot(folderNode.id) && (
                  <>
                    <IconButton label={t('rename')} onClick={() => setRenaming(true)} className="ms-1">
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton
                      label={t('delete')}
                      className="hover:text-danger"
                      onClick={async () => {
                        const n = lib.counts.get(folderNode.id) ?? 0;
                        if (!(await confirm({ message: t('confirmDelete', { n: n + 1 }), ok: t('delete'), cancel: t('cancel'), danger: true }))) return;
                        await run(send({ type: 'remove', ids: [folderNode.id] }));
                        go(routeOf({ kind: 'folder', id: folderNode.parent }));
                      }}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted">{t('results', { n: items.length })}</p>
            </div>
            {items.length > 0 && (
              <button
                className="shrink-0 text-xs text-muted hover:text-fg"
                onClick={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)))}
              >
                {t('selectAll')}
              </button>
            )}
          </div>

          {/* subfolders */}
          {subfolders.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {subfolders.map((f) => (
                <FolderChip key={f.id} node={f} count={lib.counts.get(f.id) ?? 0} onOpen={() => go(routeOf({ kind: 'folder', id: f.id }))} />
              ))}
            </div>
          )}

          {items.length === 0 ? (
            query ? (
              <Empty icon={<SearchX className="size-6" />} title={t('noResults')} hint={t('noResultsHint')}>
                {filter.kind !== 'all' && (
                  <Button size="sm" onClick={() => go('/library/all')}>
                    {t('navAll')}
                  </Button>
                )}
              </Empty>
            ) : lib.bookmarks.length === 0 ? (
              <Empty icon={<Bookmark className="size-6" />} title={t('emptyLibrary')} hint={t('emptyLibraryHint')} />
            ) : subfolders.length === 0 ? (
              <Empty icon={<Folder className="size-6" />} title={t('emptyFolder')} />
            ) : null
          ) : mode === 'grid' ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
              {items.map((n) => (
                <CardItem
                  key={n.id}
                  node={n}
                  lib={lib}
                  remote={remote}
                  selected={selected.has(n.id)}
                  selecting={selected.size > 0}
                  onSelect={() => toggle(n.id)}
                  onOpen={() => openDetails(n.id)}
                  onDragStart={(e) => onDragStart(e, n.id)}
                  showPath={filter.kind !== 'folder' || !!query}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-panel">
              {items.map((n) => (
                <Row
                  key={n.id}
                  node={n}
                  lib={lib}
                  remote={remote}
                  selected={selected.has(n.id)}
                  onSelect={() => toggle(n.id)}
                  onOpen={() => openDetails(n.id)}
                  onDragStart={(e) => onDragStart(e, n.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* bulk actions */}
      {selected.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center">
          <div className="animate-in pointer-events-auto flex items-center gap-1 rounded-2xl border border-line bg-panel p-1.5 shadow-2xl">
            <span className="px-3 text-sm font-medium">{t('selected', { n: selected.size })}</span>
            <Button size="sm" variant="ghost" icon={<FolderInput className="size-4" />} onClick={() => setMoving(true)}>
              {t('moveTo')}
            </Button>
            <Button size="sm" variant="ghost" icon={<Tag className="size-4" />} onClick={() => setTagging(true)}>
              {t('addTag')}
            </Button>
            <Button size="sm" variant="ghost" icon={<Star className="size-4" />} onClick={() => void run(send({ type: 'meta', ids: [...selected], patch: { fav: true } }))}>
              {t('favorite')}
            </Button>
            <Button size="sm" variant="ghost" className="text-danger" icon={<Trash2 className="size-4" />} onClick={() => void removeSelected()}>
              {t('delete')}
            </Button>
            <IconButton label={t('clearSelection')} onClick={() => setSelected(new Set())}>
              <X className="size-4" />
            </IconButton>
          </div>
        </div>
      )}

      <MoveDialog
        open={moving}
        lib={lib}
        onClose={() => setMoving(false)}
        onMove={async (parent) => {
          await run(send({ type: 'move', ids: [...selected], parent }));
          setMoving(false);
          setSelected(new Set());
        }}
      />
      {folderNode && (
        <RenameDialog
          open={renaming}
          initial={folderNode.title}
          onClose={() => setRenaming(false)}
          onSave={async (title) => {
            await run(send({ type: 'edit', id: folderNode.id, title }));
            setRenaming(false);
          }}
        />
      )}
      <TagDialog
        open={tagging}
        lib={lib}
        onClose={() => setTagging(false)}
        onApply={async (tags) => {
          await run(send({ type: 'tags', ids: [...selected], add: tags }));
          setTagging(false);
        }}
      />
    </div>
  );
}

function FolderChip({ node, count, onOpen }: { node: TreeNode; count: number; onOpen: () => void }) {
  const { num } = useI18n();
  const name = useFolderName();
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-sm transition hover:border-accent/50 hover:bg-hover"
    >
      <Folder className="size-4 text-accent" />
      <span className="max-w-48 truncate">{name(node)}</span>
      {count > 0 && <span className="text-xs text-muted">{num(count)}</span>}
    </button>
  );
}

function HealthDot({ node }: { node: TreeNode }) {
  const h = linkHealth(node.rec.v.status, node.rec.v.checkedAt);
  if (h !== 'broken') return null;
  return <span className="size-2 shrink-0 rounded-full bg-danger" title="broken" />;
}

function CardItem({
  node,
  lib,
  remote,
  selected,
  selecting,
  onSelect,
  onOpen,
  onDragStart,
  showPath,
}: {
  node: TreeNode;
  lib: Lib;
  remote: boolean;
  selected: boolean;
  selecting: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onDragStart: (e: DragEvent) => void;
  showPath: boolean;
}) {
  const { t } = useI18n();
  const v = node.rec.v;
  const name = useFolderName();
  const parent = lib.tree.byId.get(node.parent);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={cx(
        'cv-auto group relative flex flex-col overflow-hidden rounded-xl border bg-card transition hover:-translate-y-0.5 hover:shadow-lg',
        selected ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-accent/40',
      )}
    >
      <a
        href={node.url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => {
          if (selecting) {
            e.preventDefault();
            onSelect();
          }
        }}
        className="relative block aspect-[16/10] overflow-hidden border-b border-line bg-hover"
      >
        <Preview node={node} remote={remote} />
      </a>
      <button
        onClick={onSelect}
        aria-label="select"
        className={cx(
          'absolute start-2 top-2 flex size-6 items-center justify-center rounded-md border transition',
          selected ? 'border-accent bg-accent text-accent-fg' : 'border-white/60 bg-black/30 text-transparent opacity-0 backdrop-blur group-hover:opacity-100',
        )}
      >
        <Check className="size-3.5" />
      </button>
      <div className="absolute end-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={() => void send({ type: 'meta', ids: [node.id], patch: { fav: !v.fav } })}
          className="flex size-7 items-center justify-center rounded-md bg-black/40 text-white backdrop-blur hover:bg-black/60"
          title={v.fav ? t('unfavorite') : t('favorite')}
        >
          <Star className={cx('size-3.5', v.fav && 'fill-yellow-400 text-yellow-400')} />
        </button>
        <button onClick={onOpen} className="flex size-7 items-center justify-center rounded-md bg-black/40 text-white backdrop-blur hover:bg-black/60" title={t('edit')}>
          <Pencil className="size-3.5" />
        </button>
      </div>
      {v.fav && <Star className="absolute end-2 top-2 size-4 fill-yellow-400 text-yellow-400 drop-shadow group-hover:hidden" />}
      <div className="flex min-h-0 flex-1 cursor-pointer flex-col gap-1.5 p-3" onClick={onOpen}>
        <div className="flex items-start gap-2">
          <Favicon url={node.url} remote={remote} />
          <h3 dir="auto" className="line-clamp-2 min-w-0 flex-1 text-start text-[13.5px] font-semibold leading-snug">{node.title || hostOf(node.url)}</h3>
          <HealthDot node={node} />
        </div>
        <div className="ltr truncate text-start text-xs text-muted">{hostOf(node.url)}</div>
        {(v.notes || v.desc) && <p dir="auto" className="line-clamp-2 text-start text-xs leading-relaxed text-fg/70">{v.notes || v.desc}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
          {showPath && parent && (
            <span className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-hover px-1.5 py-0.5 text-[11px] text-muted">
              <Folder className="size-3" />
              {name(parent)}
            </span>
          )}
          {(v.tags ?? []).slice(0, 4).map((tag) => (
            <span key={tag} dir="auto" className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({
  node,
  lib,
  remote,
  selected,
  onSelect,
  onOpen,
  onDragStart,
}: {
  node: TreeNode;
  lib: Lib;
  remote: boolean;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onDragStart: (e: DragEvent) => void;
}) {
  const v = node.rec.v;
  const name = useFolderName();
  const parent = lib.tree.byId.get(node.parent);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={cx('group flex h-12 items-center gap-3 border-b border-line px-3 last:border-b-0 hover:bg-hover', selected && 'bg-accent-soft/60')}
    >
      <button
        onClick={onSelect}
        className={cx(
          'flex size-5 shrink-0 items-center justify-center rounded border transition',
          selected ? 'border-accent bg-accent text-accent-fg' : 'border-line text-transparent group-hover:border-muted',
        )}
      >
        <Check className="size-3" />
      </button>
      <Favicon url={node.url} remote={remote} />
      <button onClick={onOpen} className="min-w-0 flex-1 text-start">
        <div className="flex items-center gap-2">
          <span dir="auto" className="truncate text-[13.5px] font-medium">{node.title || hostOf(node.url)}</span>
          {v.fav && <Star className="size-3.5 shrink-0 fill-yellow-400 text-yellow-400" />}
          <HealthDot node={node} />
        </div>
        <div className="truncate text-xs text-muted">{v.notes || <span className="ltr">{hostOf(node.url)}</span>}</div>
      </button>
      <div className="hidden max-w-[30%] shrink-0 items-center gap-1 overflow-hidden md:flex">
        {(v.tags ?? []).slice(0, 3).map((tag) => (
          <span key={tag} dir="auto" className="truncate rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">
            #{tag}
          </span>
        ))}
      </div>
      {parent && <span className="hidden w-36 shrink-0 truncate text-xs text-muted lg:block">{name(parent)}</span>}
      <a href={node.url} target="_blank" rel="noreferrer" className="shrink-0 text-muted opacity-0 hover:text-accent group-hover:opacity-100">
        <ArrowUpRight className="size-4" />
      </a>
    </div>
  );
}

function MoveDialog({ open, lib, onClose, onMove }: { open: boolean; lib: Lib; onClose: () => void; onMove: (parent: string) => Promise<void> }) {
  const { t } = useI18n();
  const [target, setTarget] = useState<string>(ROOT.other);
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={t('moveTo')}>
      <FolderSelect tree={lib.tree} value={target} onChange={setTarget} />
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button
          variant="primary"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await onMove(target);
            setBusy(false);
          }}
        >
          {t('moveTo').replace('…', '')}
        </Button>
      </div>
    </Modal>
  );
}

function TagDialog({ open, lib, onClose, onApply }: { open: boolean; lib: Lib; onClose: () => void; onApply: (tags: string[]) => Promise<void> }) {
  const { t } = useI18n();
  const [tags, setTags] = useState<string[]>([]);
  return (
    <Modal open={open} onClose={onClose} title={t('addTag')}>
      <TagInput value={tags} onChange={setTags} suggestions={lib.tags.map(([x]) => x)} placeholder={t('tagsPlaceholder')} />
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button
          variant="primary"
          disabled={!tags.length}
          onClick={async () => {
            await onApply(tags);
            setTags([]);
          }}
        >
          {t('save')}
        </Button>
      </div>
    </Modal>
  );
}

function RenameDialog({ open, initial, onClose, onSave }: { open: boolean; initial: string; onClose: () => void; onSave: (t: string) => Promise<void> }) {
  const { t } = useI18n();
  const [title, setTitle] = useState(initial);
  useEffect(() => {
    if (open) setTitle(initial);
  }, [open, initial]);
  return (
    <Modal open={open} onClose={onClose} title={t('rename')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) void onSave(title.trim());
        }}
        className="space-y-4"
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!title.trim()}>
            {t('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
