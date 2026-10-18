import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, AlertTriangle, Bookmark, CheckCircle2, Cloud, Copy, Folder, Hash, History, Laptop, Loader2, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { hostOf } from '../../core/normalize';
import { db } from '../../db/db';
import { linkHealth } from '../../enrich/metadata';
import { send } from '../../lib/messages';
import { Favicon } from '../components/bits';
import { Badge, Button, Card, cx } from '../components/ui';
import { useEnrichStatus, useSettings, useStatus, type Library } from '../hooks';
import { useI18n, type StringKey } from '../i18n';

const PROVIDER_KEYS: Record<string, StringKey> = {
  gdrive: 'providerGdrive',
  dropbox: 'providerDropbox',
  onedrive: 'providerOnedrive',
  webdav: 'providerWebdav',
  s3: 'providerS3',
  github: 'providerGithub',
};

export function Dashboard({ lib, go }: { lib: Library; go: (r: string) => void }) {
  const { t, num, ago } = useI18n();
  const status = useStatus();
  const enrich = useEnrichStatus();
  const [settings] = useSettings();
  const logs = useLiveQuery(() => db.logs.orderBy('at').reverse().limit(12).toArray(), []) ?? [];
  const deviceId = useLiveQuery(async () => ((await db.kv.get('device'))?.value as { deviceId?: string } | undefined)?.deviceId, []);

  const folders = [...lib.tree.byId.values()].filter((n) => n.kind === 'folder').length;
  const broken = lib.bookmarks.filter((b) => linkHealth(b.rec.v.status, b.rec.v.checkedAt, b.url) === 'broken').length;
  const dups = [...lib.dupGroups.values()].reduce((n, g) => n + g.length, 0);
  const checked = lib.bookmarks.filter((b) => b.rec.v.checkedAt).length;

  const sites = new Map<string, { n: number; url: string }>();
  for (const b of lib.bookmarks) {
    const h = hostOf(b.url);
    if (!h) continue;
    const s = sites.get(h);
    if (s) s.n++;
    else sites.set(h, { n: 1, url: b.url });
  }
  const top = [...sites].sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  const maxTop = top[0]?.[1].n ?? 1;

  // Activity heat strip: syncs per day for the last 12 weeks.
  const days = 84;
  const allLogs = useLiveQuery(() => db.logs.where('at').above(Date.now() - days * 86400_000).toArray(), []) ?? [];
  const perDay = new Array<number>(days).fill(0);
  for (const l of allLogs) {
    const d = Math.floor((Date.now() - l.at) / 86400_000);
    if (d >= 0 && d < days) perDay[days - 1 - d]++;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('dashTitle')}</h1>
          <p className="mt-1 text-sm text-muted">{t('dashSubtitle')}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Stat icon={<Bookmark className="size-4" />} label={t('statBookmarks')} value={num(lib.bookmarks.length)} onClick={() => go('/library/all')} />
          <Stat icon={<Folder className="size-4" />} label={t('statFolders')} value={num(folders)} />
          <Stat icon={<Hash className="size-4" />} label={t('statTags')} value={num(lib.tags.length)} />
          <Stat icon={<Copy className="size-4" />} label={t('statDuplicates')} value={num(dups)} tone={dups ? 'warn' : undefined} onClick={() => go('/library/dups')} />
          <Stat icon={<AlertTriangle className="size-4" />} label={t('statBroken')} value={num(broken)} tone={broken ? 'danger' : undefined} onClick={() => go('/library/broken')} />
          <Stat
            icon={<Cloud className="size-4" />}
            label={t('statStorage')}
            value={settings.remote ? t(PROVIDER_KEYS[settings.remote.type]) : t('notConnected')}
            small
            sub={settings.remote ? `${t('statLastSync')}: ${ago(status.lastSync)}` : undefined}
            onClick={() => go('/settings/sync')}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">{t('activity')}</h2>
              <Button size="sm" onClick={() => void send({ type: 'sync' }).catch(() => undefined)} loading={status.state === 'running'}>
                {t('syncNow')}
              </Button>
            </div>
            <div className="mb-5 grid w-fit grid-flow-col grid-rows-7 gap-1" dir="ltr">
              {perDay.map((n, i) => (
                <div
                  key={i}
                  title={String(n)}
                  className={cx('size-3 rounded-[3px]', n === 0 ? 'bg-hover' : n < 3 ? 'bg-accent/35' : n < 8 ? 'bg-accent/65' : 'bg-accent')}
                />
              ))}
            </div>
            {logs.length === 0 ? (
              <p className="text-sm text-muted">{t('activityEmpty')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {logs.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-2 text-sm">
                    {l.ok ? <CheckCircle2 className="size-4 shrink-0 text-ok" /> : <XCircle className="size-4 shrink-0 text-danger" />}
                    <span className="min-w-0 flex-1 truncate">{l.ok && l.report ? <ReportLine r={l.report} /> : l.message}</span>
                    {l.mode !== 'normal' && <Badge tone="warn">{l.mode}</Badge>}
                    <span className="shrink-0 text-xs text-muted">{ago(l.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">{t('devices')}</h2>
              <ul className="space-y-2.5">
                <li className="flex items-center gap-3 text-sm">
                  <Laptop className="size-4 text-accent" />
                  <span className="flex-1 truncate">{settings.deviceName || t('thisDevice')}</span>
                  <Badge tone="accent">{t('thisDevice')}</Badge>
                </li>
                {status.devices
                  .filter((d) => d.id !== deviceId)
                  .map((d) => (
                    <li key={d.id} className="flex items-center gap-3 text-sm">
                      <Laptop className="size-4 text-muted" />
                      <span className="flex-1 truncate">{d.name}</span>
                      <span className="text-xs text-muted">{ago(d.updatedAt)}</span>
                    </li>
                  ))}
              </ul>
              {status.devices.filter((d) => d.id !== deviceId).length === 0 && <p className="mt-3 text-xs text-muted">{t('devicesEmpty')}</p>}
            </Card>

            <Card className="p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold">{t('previewsProgress')}</h2>
                {enrich.running && <Loader2 className="size-4 animate-spin text-accent" />}
              </div>
              <p className="text-xs text-muted">{t('previewsDone', { done: enrich.running ? enrich.done : checked, total: enrich.running ? enrich.total : lib.bookmarks.length })}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-hover">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{
                    width: `${Math.round((100 * (enrich.running ? enrich.done : checked)) / Math.max(1, enrich.running ? enrich.total : lib.bookmarks.length))}%`,
                  }}
                />
              </div>
              <Button size="sm" className="mt-3" onClick={() => go('/settings/previews')}>
                <History className="size-3.5" />
                {t('tabPreviews')}
              </Button>
            </Card>
          </div>
        </div>

        {top.length > 0 && (
          <Card className="p-5">
            <h2 className="mb-4 font-semibold">{t('topSites')}</h2>
            <div className="grid gap-x-8 gap-y-2.5 md:grid-cols-2">
              {top.map(([host, { n, url }]) => (
                <button key={host} onClick={() => go('/library/all')} className="flex items-center gap-3 text-start text-sm">
                  <Favicon url={url} remote={settings.previews.fetchMeta} />
                  <span className="ltr w-40 truncate">{host}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-hover">
                    <span className="block h-full rounded-full bg-accent/70" style={{ width: `${(100 * n) / maxTop}%` }} />
                  </span>
                  <span className="w-8 text-end text-xs tabular-nums text-muted">{num(n)}</span>
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  tone,
  small,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: 'warn' | 'danger';
  small?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="rounded-xl border border-line bg-panel p-4 text-start transition enabled:hover:border-accent/50 enabled:hover:bg-hover"
    >
      <div className="flex items-center justify-between text-xs text-muted">
        {label}
        <span className={cx(tone === 'warn' && 'text-warn', tone === 'danger' && 'text-danger')}>{icon}</span>
      </div>
      <div dir="auto" className={cx('mt-2 truncate text-start font-bold tracking-tight', small ? 'text-lg' : 'text-2xl', tone === 'danger' && 'text-danger', tone === 'warn' && 'text-warn')}>
        {value}
      </div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-muted">{sub}</div>}
    </button>
  );
}

/** Language-neutral summary of one sync: ↑ sent, ↓ received, and what changed in this browser. */
function ReportLine({ r }: { r: import('../../sync/engine').SyncReport }) {
  const { t, num } = useI18n();
  const a = r.applied;
  const changed = a.created + a.updated + a.moved + a.removed;
  if (!r.localChanges && !r.remoteChanges && !changed) return <span className="text-muted">{t('statusIdle')}</span>;
  return (
    <span className="inline-flex items-center gap-3 tabular-nums" dir="ltr">
      <span className="inline-flex items-center gap-1" title="↑">
        <ArrowUp className="size-3.5 text-accent" />
        {num(r.localChanges)}
      </span>
      <span className="inline-flex items-center gap-1" title="↓">
        <ArrowDown className="size-3.5 text-ok" />
        {num(r.remoteChanges)}
      </span>
      {changed > 0 && (
        <span className="text-muted">
          +{num(a.created)} ~{num(a.updated + a.moved)} −{num(a.removed)}
        </span>
      )}
    </span>
  );
}
