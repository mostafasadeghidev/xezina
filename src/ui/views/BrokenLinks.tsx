import { ArrowRight, Archive, CheckCheck, Pencil, RefreshCw, Trash2, Wand2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { displayTitle } from '../../core/normalize';
import type { TreeNode } from '../../core/tree';
import { send } from '../../lib/messages';
import { Favicon } from '../components/bits';
import { Badge, Button, useConfirm, useToast } from '../components/ui';
import { useI18n } from '../i18n';

const archiveUrl = (url: string) => `https://web.archive.org/web/2/${url}`;

/**
 * Broken links, sorted by what can be done about them:
 *  1. the page is gone but the site (or a parent page) works → use that address
 *  2. the page moved → use the new address
 *  3. nothing on the site answers → archived copy or delete
 */
export function BrokenLinks({ items, openDetails, remote }: { items: TreeNode[]; openDetails: (id: string) => void; remote: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);

  const siteOk = items.filter((n) => n.rec.v.fixUrl && (n.rec.v.fixKind === 'parent' || n.rec.v.fixKind === 'root'));
  const moved = items.filter((n) => n.rec.v.fixUrl && n.rec.v.fixKind === 'moved');
  const dead = items.filter((n) => !n.rec.v.fixUrl);
  const fixable = [...siteOk, ...moved];

  const apply = async (nodes: TreeNode[]) => {
    for (const n of nodes) await send({ type: 'edit', id: n.id, url: n.rec.v.fixUrl as string });
  };

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

  const row = (n: TreeNode, kind: 'fix' | 'dead') => (
    <div key={n.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0">
      <Favicon url={n.url} remote={remote} />
      <div className="min-w-0 flex-1">
        <button dir="auto" onClick={() => openDetails(n.id)} className="block max-w-full truncate text-start text-[13.5px] font-medium hover:underline">
          {displayTitle(n.title, n.url, n.rec.v)}
        </button>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs" dir="ltr">
          <span className={kind === 'fix' && n.rec.v.fixKind !== 'moved' ? 'truncate text-muted line-through' : 'truncate text-muted'}>{n.url}</span>
          {kind === 'fix' && (
            <>
              <ArrowRight className="size-3 shrink-0 text-muted" />
              <span className="truncate font-medium text-ok">{n.rec.v.fixUrl}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {kind === 'fix' && (
          <Button
            size="sm"
            variant="primary"
            icon={<Wand2 className="size-3.5" />}
            loading={busy === n.id}
            onClick={() => void run(n.id, () => apply([n]), t('done'))}
          >
            {t('useSuggestion')}
          </Button>
        )}
        <a href={archiveUrl(n.url)} target="_blank" rel="noreferrer">
          <Button size="sm" variant="ghost" icon={<Archive className="size-3.5" />}>
            {t('archived')}
          </Button>
        </a>
        <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => openDetails(n.id)} title={t('edit')}>
          <span className="sr-only">{t('edit')}</span>
        </Button>
        {kind === 'dead' && (
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

  const section = (title: string, tone: 'ok' | 'warn' | 'danger', list: TreeNode[], kind: 'fix' | 'dead', extra?: ReactNode) =>
    list.length > 0 && (
      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <header className="flex flex-wrap items-center gap-2 border-b border-line bg-hover/60 px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          <Badge tone={tone}>{list.length}</Badge>
          <div className="ms-auto">{extra}</div>
        </header>
        {list.map((n) => row(n, kind))}
      </section>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel p-4">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">{t('brokenHint')}</p>
        <Button
          size="sm"
          icon={<RefreshCw className="size-3.5" />}
          onClick={() => {
            void send({ type: 'enrich', ids: items.map((i) => i.id) });
            toast(t('previewsProgress'));
          }}
        >
          {t('recheckAll')}
        </Button>
        {fixable.length > 0 && (
          <Button
            size="sm"
            variant="primary"
            icon={<CheckCheck className="size-3.5" />}
            loading={busy === 'all'}
            onClick={async () => {
              if (await confirm({ message: t('fixAllConfirm', { n: fixable.length }), ok: t('fixAll', { n: fixable.length }), cancel: t('cancel') }))
                void run('all', () => apply(fixable), t('done'));
            }}
          >
            {t('fixAll', { n: fixable.length })}
          </Button>
        )}
      </div>
      {section(t('brokenSiteOk'), 'warn', siteOk, 'fix')}
      {section(t('brokenMoved'), 'ok', moved, 'fix')}
      {section(t('brokenGone'), 'danger', dead, 'dead')}
    </div>
  );
}
