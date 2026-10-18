import {
  AlertTriangle,
  Bookmark,
  ChevronDown,
  Clock,
  Copy,
  Folder,
  FolderOpen,
  FolderPlus,
  Hash,
  Search,
  LayoutDashboard,
  Settings as SettingsIcon,
  Star,
  Tag,
} from 'lucide-react';
import { useState, type DragEvent, type ReactNode } from 'react';
import type { TreeNode } from '../../core/tree';
import { ROOT } from '../../core/types';
import { send } from '../../lib/messages';
import { useFolderName } from '../components/bits';
import { cx, useToast } from '../components/ui';
import type { Library } from '../hooks';
import { useI18n } from '../i18n';
import { routeOf, type Filter } from '../library';
import { SyncPill } from './SyncPill';
import { Logo } from './Logo';

export const DRAG_TYPE = 'application/x-xezina-ids';

function Item({
  icon,
  label,
  count,
  active,
  onClick,
  depth = 0,
  onDrop,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
  depth?: number;
  onDrop?: (ids: string[]) => void;
  trailing?: ReactNode;
}) {
  const { num } = useI18n();
  const [over, setOver] = useState(false);
  const dropProps = onDrop
    ? {
        onDragOver: (e: DragEvent) => {
          if (e.dataTransfer.types.includes(DRAG_TYPE)) {
            e.preventDefault();
            setOver(true);
          }
        },
        onDragLeave: () => setOver(false),
        onDrop: (e: DragEvent) => {
          setOver(false);
          const raw = e.dataTransfer.getData(DRAG_TYPE);
          if (raw) onDrop(JSON.parse(raw));
        },
      }
    : {};
  return (
    <div
      {...dropProps}
      className={cx(
        'group flex h-8 cursor-pointer items-center gap-2 rounded-lg pe-2 text-[13px] transition',
        active ? 'bg-accent-soft font-medium text-accent' : 'text-fg/85 hover:bg-hover',
        over && 'ring-2 ring-accent',
      )}
      style={{ paddingInlineStart: 8 + depth * 14 }}
      onClick={onClick}
    >
      <span className={cx('shrink-0', active ? 'text-accent' : 'text-muted')}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
      {count !== undefined && count > 0 && <span className="text-[11px] tabular-nums text-muted">{num(count)}</span>}
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-1 flex items-center justify-between px-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Sidebar({
  lib,
  filter,
  page,
  go,
  onNewFolder,
  onQuickSearch,
}: {
  lib: Library;
  filter: Filter;
  page: string;
  go: (route: string) => void;
  onNewFolder: (parent: string) => void;
  onQuickSearch: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const name = useFolderName();
  const [open, setOpen] = useState<Record<string, boolean>>({ [ROOT.toolbar]: true, [ROOT.other]: true });
  const [showAllTags, setShowAllTags] = useState(false);
  const is = (k: Filter['kind']) => page === 'library' && filter.kind === k;
  const move = async (ids: string[], parent: string) => {
    try {
      await send({ type: 'move', ids, parent });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const folder = (n: TreeNode, depth: number): ReactNode => {
    const subs = n.children.filter((c) => c.kind === 'folder');
    const isOpen = open[n.id];
    const active = page === 'library' && filter.kind === 'folder' && filter.id === n.id;
    return (
      <div key={n.id}>
        <Item
          depth={depth}
          icon={
            subs.length ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen((o) => ({ ...o, [n.id]: !o[n.id] }));
                }}
                className="flex items-center"
              >
                <ChevronDown className={cx('size-3.5 transition', !isOpen && '-rotate-90 rtl:rotate-90')} />
              </span>
            ) : active ? (
              <FolderOpen className="size-4" />
            ) : (
              <Folder className="size-4" />
            )
          }
          label={name(n)}
          count={lib.counts.get(n.id)}
          active={active}
          onClick={() => go(routeOf({ kind: 'folder', id: n.id }))}
          onDrop={(ids) => void move(ids, n.id)}
          trailing={
            <button
              title={t('newFolder')}
              onClick={(e) => {
                e.stopPropagation();
                onNewFolder(n.id);
              }}
              className="hidden text-muted hover:text-fg group-hover:block"
            >
              <FolderPlus className="size-3.5" />
            </button>
          }
        />
        {isOpen && subs.map((s) => folder(s, depth + 1))}
      </div>
    );
  };

  const roots = [ROOT.toolbar, ROOT.other, ROOT.menu, ROOT.mobile]
    .map((r) => lib.tree.roots[r])
    .filter((r) => r.id === ROOT.toolbar || r.id === ROOT.other || r.children.length);
  const tags = showAllTags ? lib.tags : lib.tags.slice(0, 12);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-e border-line bg-panel">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <Logo className="size-8" />
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight">Xezina</div>
          <div className="text-[11px] text-muted">{t('appTagline')}</div>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <button
          onClick={onQuickSearch}
          className="mb-2 flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-bg px-2.5 text-[13px] text-muted transition hover:border-accent/50 hover:text-fg"
        >
          <Search className="size-4" />
          <span className="flex-1 truncate text-start">{t('popupSearch')}</span>
          <kbd className="rounded border border-line px-1 text-[10px]" dir="ltr">
            Ctrl K
          </kbd>
        </button>
        <Item icon={<Bookmark className="size-4" />} label={t('navAll')} count={lib.bookmarks.length} active={is('all')} onClick={() => go('/library/all')} />
        <Item
          icon={<Star className="size-4" />}
          label={t('navFavorites')}
          count={lib.bookmarks.filter((b) => b.rec.v.fav).length}
          active={is('fav')}
          onClick={() => go('/library/fav')}
        />
        <Item icon={<Clock className="size-4" />} label={t('navRecent')} active={is('recent')} onClick={() => go('/library/recent')} />
        <Item
          icon={<Copy className="size-4" />}
          label={t('navDuplicates')}
          count={[...lib.dupGroups.values()].reduce((n, g) => n + g.length, 0)}
          active={is('dups')}
          onClick={() => go('/library/dups')}
        />
        <Item
          icon={<AlertTriangle className="size-4" />}
          label={t('navBroken')}
          count={lib.bookmarks.filter((b) => b.rec.v.checkedAt && (b.rec.v.status === 0 || b.rec.v.status === 404 || b.rec.v.status === 410)).length}
          active={is('broken')}
          onClick={() => go('/library/broken')}
        />
        <Item icon={<Hash className="size-4" />} label={t('navUntagged')} active={is('untagged')} onClick={() => go('/library/untagged')} />

        <Section title={t('navFolders')}>{roots.map((r) => folder(r, 0))}</Section>

        {lib.tags.length > 0 && (
          <Section
            title={t('navTags')}
            action={
              lib.tags.length > 12 ? (
                <button className="text-[11px] text-muted hover:text-fg" onClick={() => setShowAllTags((v) => !v)}>
                  {showAllTags ? '−' : `+${lib.tags.length - 12}`}
                </button>
              ) : undefined
            }
          >
            {tags.map(([tag, n]) => (
              <Item
                key={tag}
                icon={<Tag className="size-3.5" />}
                label={tag}
                count={n}
                active={page === 'library' && filter.kind === 'tag' && filter.tag === tag}
                onClick={() => go(routeOf({ kind: 'tag', tag }))}
                onDrop={(ids) => void send({ type: 'tags', ids, add: [tag] })}
              />
            ))}
          </Section>
        )}
      </nav>

      <div className="space-y-0.5 border-t border-line p-2">
        <Item icon={<LayoutDashboard className="size-4" />} label={t('navDashboard')} active={page === 'dashboard'} onClick={() => go('/dashboard')} />
        <Item icon={<SettingsIcon className="size-4" />} label={t('navSettings')} active={page === 'settings'} onClick={() => go('/settings/general')} />
        <SyncPill onOpen={() => go('/settings/sync')} />
      </div>
    </aside>
  );
}
