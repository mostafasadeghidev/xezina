import { ArrowRight, Archive, Check, CheckCheck, Pencil, RefreshCw, RotateCcw, Trash2, Wand2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { displayTitle } from '../../core/normalize';
import type { TreeNode } from '../../core/tree';
import { send } from '../../lib/messages';
import { Favicon } from '../components/bits';
import { Badge, Button, cx, useConfirm, useToast } from '../components/ui';
import { useI18n } from '../i18n';
import { needsFixing } from '../library';

const archiveUrl = (url: string) => `https://web.archive.org/web/2/${url}`;

type Group = 'siteOk' | 'moved' | 'dead' | 'fixed';

/**
 * Broken links, sorted by what can be done about them:
 *  1. the page is gone but the site (or a parent page) works → use that address
 *  2. the page moved → use the new address
 *  3. nothing on the site answers → archived copy or delete
 *  4. fixed earlier → undo or keep
 * Rows can be selected (Shift+click for a range) and fixed or undone together.
 */
export function BrokenLinks({
  items,
  openDetails,
  remote,
  selected,
  pick,
  clear,
}: {
  items: TreeNode[];
  openDetails: (id: string) => void;
  remote: boolean;
  selected: Set<string>;
  pick: (id: string, shift?: boolean) => void;
  clear: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);

  const fixed = items.filter((n) => n.rec.v.prevUrl);
  const open = items.filter((n) => !n.rec.v.prevUrl && needsFixing(n));
  const siteOk = open.filter((n) => n.rec.v.fixUrl && (n.rec.v.fixKind === 'parent' || n.rec.v.fixKind === 'root'));
  const moved = open.filter((n) => n.rec.v.fixUrl && n.rec.v.fixKind === 'moved');
  const dead = open.filter((n) => !n.rec.v.fixUrl);
  const fixable = [...siteOk, ...moved];
  const selFixable = fixable.filter((n) => selected.has(n.id));
  const selFixed = fixed.filter((n) => selected.has(n.id));

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) toast(ok);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };
  const fix = (nodes: TreeNode[]) => send({ type: 'fix:apply', ids: nodes.map((n) => n.id) });
  const undo = (nodes: TreeNode[]) => send({ type: 'fix:undo', ids: nodes.map((n) => n.id) });
  const keep = (nodes: TreeNode[]) => send({ type: 'fix:keep', ids: nodes.map((n) => n.id) });

  const row = (n: TreeNode, group: Group) => {
    const v = n.rec.v;
    const isSel = selected.has(n.id);
    return (
      <div key={n.id} className={cx('flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0', isSel && 'bg-accent-soft/50')}>
        <button
          onClick={(e) => pick(n.id, e.shiftKey)}
          aria-label="select"
          className={cx(
            'flex size-5 shrink-0 items-center justify-center rounded border transition',
            isSel ? 'border-accent bg-accent text-accent-fg' : 'border-line text-transparent hover:border-muted',
          )}
        >
          <Check className="size-3" />
        </button>
        <Favicon url={n.url} remote={remote} />
        <div className="min-w-0 flex-1">
          <button dir="auto" onClick={() => openDetails(n.id)} className="block max-w-full truncate text-start text-[13.5px] font-medium hover:underline">
            {displayTitle(n.title, n.url, v)}
          </button>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs" dir="ltr">
            {group === 'fixed' ? (
              <>
                <span className="truncate text-muted line-through">{v.prevUrl}</span>
                <ArrowRight className="size-3 shrink-0 text-muted" />
                <span className="truncate font-medium text-ok">{n.url}</span>
              </>
            ) : (
              <>
                <span className={group === 'siteOk' ? 'truncate text-muted line-through' : 'truncate text-muted'}>{n.url}</span>
                {(group === 'siteOk' || group === 'moved') && (
                  <>
                    <ArrowRight className="size-3 shrink-0 text-muted" />
                    <span className="truncate font-medium text-ok">{v.fixUrl}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {(group === 'siteOk' || group === 'moved') && (
            <Button size="sm" variant="primary" icon={<Wand2 className="size-3.5" />} loading={busy === n.id} onClick={() => void run(n.id, () => fix([n]), t('done'))}>
              {t('useSuggestion')}
            </Button>
          )}
          {group === 'fixed' && (
            <>
              <Button size="sm" icon={<RotateCcw className="size-3.5" />} loading={busy === n.id} onClick={() => void run(n.id, () => undo([n]), t('done'))}>
                {t('undo')}
              </Button>
              <Button size="sm" variant="ghost" icon={<Check className="size-3.5" />} onClick={() => void run(n.id, () => keep([n]))}>
                {t('keepFix')}
              </Button>
            </>
          )}
          {group !== 'fixed' && (
            <a href={archiveUrl(n.url)} target="_blank" rel="noreferrer">
              <Button size="sm" variant="ghost" icon={<Archive className="size-3.5" />}>
                {t('archived')}
              </Button>
            </a>
          )}
          <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => openDetails(n.id)} title={t('edit')}>
            <span className="sr-only">{t('edit')}</span>
          </Button>
          {group === 'dead' && (
            <Button
              size="sm"
              variant="ghost"
              className="text-danger"
              icon={<Trash2 className="size-3.5" />}
              onClick={async () => {
                if (await confirm({ message: t('confirmDelete', { n: 1 }), ok: t('delete'), cancel: t('cancel'), danger: true }))
                  void run(n.id, () => send({ type: 'remove', ids: [n.id] }));
              }}
            >
              <span className="sr-only">{t('delete')}</span>
            </Button>
          )}
        </div>
      </div>
    );
  };

  const section = (title: string, tone: 'ok' | 'warn' | 'danger' | 'accent', list: TreeNode[], group: Group, extra?: ReactNode) =>
    list.length > 0 && (
      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <header className="flex flex-wrap items-center gap-2 border-b border-line bg-hover/60 px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          <Badge tone={tone}>{list.length}</Badge>
          <div className="ms-auto flex gap-1.5">{extra}</div>
        </header>
        {list.map((n) => row(n, group))}
      </section>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel p-4">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
          {t('brokenHint')} {t('rangeHint')}.
        </p>
        <Button
          size="sm"
          icon={<RefreshCw className="size-3.5" />}
          onClick={() => {
            void send({ type: 'enrich', ids: open.map((i) => i.id) });
            toast(t('previewsProgress'));
          }}
        >
          {t('recheckAll')}
        </Button>
        {selFixable.length > 0 && (
          <Button size="sm" variant="primary" icon={<Wand2 className="size-3.5" />} loading={busy === 'sel'} onClick={() => void run('sel', async () => (await fix(selFixable), clear()), t('done'))}>
            {t('fixSelected', { n: selFixable.length })}
          </Button>
        )}
        {selFixed.length > 0 && (
          <Button size="sm" icon={<RotateCcw className="size-3.5" />} loading={busy === 'usel'} onClick={() => void run('usel', async () => (await undo(selFixed), clear()), t('done'))}>
            {t('undoSelected', { n: selFixed.length })}
          </Button>
        )}
        {fixable.length > 0 && selFixable.length === 0 && (
          <Button
            size="sm"
            variant="primary"
            icon={<CheckCheck className="size-3.5" />}
            loading={busy === 'all'}
            onClick={async () => {
              if (await confirm({ message: t('fixAllConfirm', { n: fixable.length }), ok: t('fixAll', { n: fixable.length }), cancel: t('cancel') }))
                void run('all', () => fix(fixable), t('done'));
            }}
          >
            {t('fixAll', { n: fixable.length })}
          </Button>
        )}
      </div>
      {section(t('brokenMoved'), 'ok', moved, 'moved')}
      {section(t('brokenSiteOk'), 'warn', siteOk, 'siteOk')}
      {section(t('brokenGone'), 'danger', dead, 'dead')}
      {section(
        t('fixedGroup'),
        'accent',
        fixed,
        'fixed',
        <>
          <Button size="sm" icon={<RotateCcw className="size-3.5" />} loading={busy === 'uall'} onClick={() => void run('uall', () => undo(fixed), t('done'))}>
            {t('undoAll', { n: fixed.length })}
          </Button>
          <Button size="sm" variant="ghost" icon={<Check className="size-3.5" />} onClick={() => void run('kall', () => keep(fixed))}>
            {t('keepAll')}
          </Button>
        </>,
      )}
    </div>
  );
}
